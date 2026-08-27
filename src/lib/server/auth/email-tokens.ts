import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { query, withTransaction } from "../db";

/**
 * Одноразовые ссылки: подтверждение почты и сброс пароля.
 *
 * Устройство то же, что у refresh-токенов: наружу уходит случайная строка, в
 * базе лежит её SHA-256. Копия базы не даёт сменить кому-то пароль.
 *
 * Три свойства, без которых ссылка небезопасна:
 *  * **срок** — просроченная не работает;
 *  * **одноразовость** — использованная не работает второй раз, даже если
 *    письмо переслали или оно осталось в истории браузера;
 *  * **вытеснение** — выдача новой гасит предыдущие, чтобы у злоумышленника
 *    не накапливались живые ссылки.
 */

export type TokenPurpose = "email_verification" | "password_reset";

/**
 * Сроки жизни. Разные не случайно: письмо о сбросе пароля — самая лакомая
 * цель, и каждый лишний час его жизни это лишний час чужой возможности.
 * Подтверждению почты спешить некуда.
 */
const TTL_MINUTES: Record<TokenPurpose, number> = {
  email_verification: 24 * 60,
  password_reset: 60,
};

/** Не больше трёх писем в час на человека — иначе почтовый ящик завалят. */
const MAX_PER_HOUR = 3;

export class TooManyRequestsError extends Error {
  constructor() {
    super("Слишком много запросов. Попробуйте через час.");
  }
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Выдаёт токен и возвращает его — единственный раз, когда он существует в
 * открытом виде. Дальше он живёт только в письме.
 */
export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const { rows: recent } = await query<{ count: string }>(
    `select count(*) as count from auth_tokens
      where user_id = $1 and purpose = $2 and created_at > now() - interval '1 hour'`,
    [userId, purpose],
  );
  if (Number(recent[0].count) >= MAX_PER_HOUR) throw new TooManyRequestsError();

  const token = randomBytes(32).toString("base64url");

  await withTransaction(async (client) => {
    // Гасим прежние: две живые ссылки на сброс пароля — это две возможности
    // вместо одной, и вторая всегда лишняя.
    await client.query(
      `update auth_tokens set used_at = now()
        where user_id = $1 and purpose = $2 and used_at is null`,
      [userId, purpose],
    );
    await client.query(
      `insert into auth_tokens (user_id, purpose, token_hash, expires_at)
       values ($1, $2, $3, now() + make_interval(mins => $4))`,
      [userId, purpose, hash(token), TTL_MINUTES[purpose]],
    );
  });

  return token;
}

/**
 * Забирает токен: проверяет и сразу помечает использованным.
 *
 * Проверка и погашение — одним запросом. Разнеси их на два шага, и два
 * одновременных перехода по одной ссылке оба бы прошли: обычная гонка,
 * которую в отладке не поймать, а в проде она случается.
 */
export async function consumeToken(
  token: string,
  purpose: TokenPurpose,
): Promise<{ userId: string } | null> {
  const { rows } = await query<{ user_id: string }>(
    `update auth_tokens
        set used_at = now()
      where token_hash = $1
        and purpose = $2
        and used_at is null
        and expires_at > now()
      returning user_id`,
    [hash(token), purpose],
  );
  return rows[0] ? { userId: rows[0].user_id } : null;
}

/** Уборка: погашенные и просроченные строки не нужны никому. */
export async function purgeUsedTokens(olderThanDays = 30): Promise<number> {
  const { rowCount } = await query(
    `delete from auth_tokens
      where (used_at is not null or expires_at < now())
        and created_at < now() - make_interval(days => $1)`,
    [olderThanDays],
  );
  return rowCount ?? 0;
}
