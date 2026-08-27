import "server-only";

import type { PoolClient } from "pg";
import { query } from "../db";

/**
 * Уведомления внутри сайта.
 *
 * Главное правило: **уведомление создаётся той же транзакцией, что и
 * событие.** Не «после того, как отклик записан», а вместе с ним. Иначе
 * появляется отклик, о котором клиенту не сообщили, — и заметит это не
 * программист, а клиент, у которого «никто не откликался», хотя откликнулись.
 *
 * Поэтому все функции создания принимают клиента транзакции, а не работают
 * сами по себе: снаружи невозможно записать событие, забыв про уведомление.
 */

export type NotificationKind =
  /** Приветствие после регистрации. Показывается ровно один раз. */
  | "welcome"
  | "response_received"
  | "response_accepted"
  | "response_rejected"
  | "request_completed"
  | "message_received"
  | "request_cancelled"
  | "subscription_expiring"
  | "subscription_expired";

export interface NotificationRow {
  id: string;
  kind: NotificationKind;
  text: string;
  requestId: string | null;
  responseId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NewNotification {
  userId: string;
  kind: NotificationKind;
  text: string;
  requestId?: string | null;
  responseId?: string | null;
}

/**
 * Создаёт уведомления внутри уже открытой транзакции.
 *
 * Списком, а не по одному: принятие отклика рождает сразу несколько —
 * победителю и всем остальным, — и отдельный запрос на каждого означал бы
 * десять обращений к базе там, где хватает одного.
 */
export async function createNotifications(
  client: PoolClient,
  items: NewNotification[],
): Promise<number> {
  if (items.length === 0) return 0;

  const { rowCount } = await client.query(
    `insert into notifications (user_id, kind, text, request_id, response_id)
     select * from unnest(
       $1::uuid[], $2::notification_kind[], $3::text[], $4::uuid[], $5::uuid[]
     )
     -- Напоминания о подписке шлёт ежедневная задача, и повтор в тот же день
     -- гасится частичным уникальным индексом (миграция 0007). Здесь он
     -- превращается в тишину вместо ошибки: не отправить второе напоминание —
     -- это успех, а не сбой.
     on conflict do nothing`,
    [
      items.map((i) => i.userId),
      items.map((i) => i.kind),
      items.map((i) => i.text),
      items.map((i) => i.requestId ?? null),
      items.map((i) => i.responseId ?? null),
    ],
  );

  // Сколько строк действительно добавилось: погашенные повторы сюда не
  // попадают, и вызывающий не отчитается о напоминании, которого не было.
  return rowCount ?? 0;
}

/** Непрочитанные и последние — одним запросом, для колокольчика. */
export async function listNotifications(
  userId: string,
  limit = 20,
): Promise<{ unread: number; items: NotificationRow[] }> {
  const { rows } = await query<NotificationRow>(
    `select id,
            kind,
            text,
            request_id  as "requestId",
            response_id as "responseId",
            read_at     as "readAt",
            created_at  as "createdAt"
       from notifications
      where user_id = $1
      order by created_at desc
      limit $2`,
    [userId, limit],
  );

  // Счётчик считается отдельно: непрочитанных может быть больше, чем влезло
  // в выборку, и «3» на колокольчике при пяти непрочитанных — это неправда.
  const { rows: counted } = await query<{ unread: string }>(
    `select count(*) as unread from notifications
      where user_id = $1 and read_at is null`,
    [userId],
  );

  return { unread: Number(counted[0].unread), items: rows };
}

/**
 * Отмечает прочитанным.
 *
 * Владелец сверяется тем же запросом: роль не даёт права трогать чужие
 * уведомления, а перебором id иначе можно было бы гасить чужой колокольчик.
 */
export async function markRead(userId: string, notificationId: string): Promise<boolean> {
  const { rowCount } = await query(
    `update notifications set read_at = now()
      where id = $1 and user_id = $2 and read_at is null`,
    [notificationId, userId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Непоказанное приветствие, если оно есть.
 *
 * Отдельным запросом, а не поиском по общему списку: список ограничен
 * двадцатью свежими, а приветствие — самое старое уведомление человека, и у
 * активного пользователя оно из выдачи выпадает. Карточка тогда не появилась
 * бы вовсе у тех, кто успел набрать двадцать событий до первого захода.
 */
export async function findUnseenWelcome(userId: string): Promise<NotificationRow | null> {
  const { rows } = await query<NotificationRow>(
    `select id,
            kind,
            text,
            request_id  as "requestId",
            response_id as "responseId",
            read_at     as "readAt",
            created_at  as "createdAt"
       from notifications
      where user_id = $1 and kind = 'welcome' and read_at is null
      limit 1`,
    [userId],
  );
  return rows[0] ?? null;
}

/** «Прочитать все» — одна кнопка вместо двадцати кликов. */
export async function markAllRead(userId: string): Promise<number> {
  const { rowCount } = await query(
    `update notifications set read_at = now()
      where user_id = $1 and read_at is null`,
    [userId],
  );
  return rowCount ?? 0;
}
