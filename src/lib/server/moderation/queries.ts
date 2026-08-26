import "server-only";

import { query, withTransaction } from "../db";
import { logPersonalDataAccess } from "../audit/personal-data";
import type { UserRole } from "../auth/tokens";

/**
 * Модерация пользователей.
 *
 * Главное правило: **решение без причины не сохраняется.** Причина не
 * пожелание, а часть решения — 289-ФЗ требует, чтобы ограничение доступа
 * можно было объяснить тому, кого ограничили. Причину, которую не записали в
 * момент решения, через месяц не восстановить.
 */

export type UserStatus = "pending" | "active" | "blocked" | "deleted";

export interface ManagedUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  email: string | null;
  phone: string | null;
  displayName: string;
  city: string | null;
  createdAt: Date;
  emailVerifiedAt: Date | null;
  /** Последнее решение по этому человеку — чтобы причина была на виду. */
  lastAction: {
    action: string;
    reason: string;
    actorName: string | null;
    createdAt: Date;
  } | null;
}

export class ModerationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Минимальная длина причины. Совпадает с проверкой в базе (0005). */
export const MIN_REASON_LENGTH = 10;

/**
 * Список пользователей для модератора.
 *
 * Каждый показ чужих данных попадает в журнал 152-ФЗ. Это не формальность:
 * без такой записи невозможно ответить, кто и когда смотрел чужую почту.
 */
export async function listUsers(options: {
  actorId: string;
  status?: UserStatus | "all";
  search?: string | null;
}): Promise<ManagedUser[]> {
  const status = options.status && options.status !== "all" ? options.status : null;
  const search = options.search?.trim() || null;

  const { rows } = await query<ManagedUser>(
    `select u.id,
            u.role,
            u.status,
            u.email,
            u.phone,
            u.display_name      as "displayName",
            u.city,
            u.created_at        as "createdAt",
            u.email_verified_at as "emailVerifiedAt",
            (
              select json_build_object(
                       'action',     a.action,
                       'reason',     a.reason,
                       'actorName',  actor.display_name,
                       'createdAt',  a.created_at)
                from moderation_actions a
                left join users actor on actor.id = a.actor_id
               where a.target_id = u.id
               order by a.created_at desc
               limit 1
            ) as "lastAction"
       from users u
      where ($1::user_status is null or u.status = $1)
        -- Поиск по имени и почте. ILIKE, а не полнотекстовый поиск:
        -- модератор ищет по точному куску адреса, а не по смыслу.
        and ($2::text is null
             or u.display_name ilike '%' || $2 || '%'
             or u.email ilike '%' || $2 || '%')
        and u.status <> 'deleted'
      order by
        -- Ждущие проверки — наверх: это очередь, а не справочник.
        case when u.status = 'pending' then 0 else 1 end,
        u.created_at desc
      limit 100`,
    [status, search],
  );

  await logPersonalDataAccess({
    actorId: options.actorId,
    subjectIds: rows.map((r) => r.id),
    purpose: "moderation_list",
    fields: ["email", "phone", "displayName", "city"],
  });

  return rows;
}

export interface ModerationHistoryEntry {
  id: string;
  action: string;
  reason: string;
  actorName: string | null;
  previousStatus: UserStatus;
  newStatus: UserStatus;
  createdAt: Date;
}

/** Вся история решений по одному человеку — она же его право знать причину. */
export async function listUserHistory(targetId: string): Promise<ModerationHistoryEntry[]> {
  const { rows } = await query<ModerationHistoryEntry>(
    `select a.id,
            a.action,
            a.reason,
            actor.display_name as "actorName",
            a.previous_status  as "previousStatus",
            a.new_status       as "newStatus",
            a.created_at       as "createdAt"
       from moderation_actions a
       left join users actor on actor.id = a.actor_id
      where a.target_id = $1
      order by a.created_at desc`,
    [targetId],
  );
  return rows;
}

/**
 * Решение модератора.
 *
 * Смена статуса и запись причины — одной транзакцией. Иначе появляется
 * заблокированный пользователь без объяснения, а это ровно то состояние,
 * которого закон и требует избегать.
 *
 * Блокировка закрывает все сессии: иначе заблокированный продолжит работать
 * до конца жизни своего токена, и «заблокирован» окажется словом, а не делом.
 */
export async function applyModerationAction(input: {
  actorId: string;
  targetId: string;
  action: "approve" | "block" | "unblock";
  reason: string;
}): Promise<{ status: UserStatus }> {
  const reason = input.reason.trim();
  if (reason.length < MIN_REASON_LENGTH) {
    throw new ModerationError(
      `Причина обязательна и должна быть не короче ${MIN_REASON_LENGTH} символов`,
      400,
    );
  }
  if (input.actorId === input.targetId) {
    throw new ModerationError("Нельзя применить решение к самому себе", 400);
  }

  return withTransaction(async (client) => {
    // `for update` — чтобы два модератора, нажавшие одновременно, не
    // записали два противоречащих решения по одному человеку.
    const { rows } = await client.query<{ status: UserStatus; role: UserRole }>(
      `select status, role from users where id = $1 for update`,
      [input.targetId],
    );
    const target = rows[0];
    if (!target) throw new ModerationError("Пользователь не найден", 404);

    if (target.role === "admin") {
      throw new ModerationError("Администратора нельзя заблокировать через модерацию", 403);
    }

    const nextStatus: UserStatus =
      input.action === "block" ? "blocked" : "active";

    if (target.status === nextStatus) {
      throw new ModerationError(`Пользователь уже в состоянии «${nextStatus}»`, 409);
    }

    await client.query(`update users set status = $2 where id = $1`, [
      input.targetId,
      nextStatus,
    ]);

    await client.query(
      `insert into moderation_actions
         (actor_id, target_id, action, reason, previous_status, new_status)
       values ($1, $2, $3, $4, $5, $6)`,
      [input.actorId, input.targetId, input.action, reason, target.status, nextStatus],
    );

    if (nextStatus === "blocked") {
      await client.query(
        `update auth_sessions set revoked_at = now()
          where user_id = $1 and revoked_at is null`,
        [input.targetId],
      );
    }

    return { status: nextStatus };
  });
}
