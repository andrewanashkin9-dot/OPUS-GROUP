import "server-only";

import { query } from "../db";

/**
 * Ограничение частоты попыток входа.
 *
 * Пределов два, и они разные по назначению:
 *
 *   * **по адресу почты** — защищает одного человека от прицельного подбора;
 *   * **по адресу источника (IP)** — защищает всех остальных от «распыления»,
 *     когда с одной машины перебирают по одному паролю к тысяче аккаунтов.
 *     Первый предел такую атаку не заметит: на каждый аккаунт приходится
 *     всего одна-две попытки.
 *
 * Счётчик хранится в PostgreSQL, а не в памяти процесса. В памяти он на
 * Vercel бесполезен: запросы расходятся по нескольким копиям приложения, у
 * каждой свой счётчик, и предел множится на их число. А после простоя копия
 * засыпает, и счётчик обнуляется сам собой.
 */

/** Окно, за которое считаются неудачи, и на столько же закрывается вход. */
const WINDOW_MINUTES = 15;

/**
 * Пять неудач на один адрес за 15 минут.
 *
 * Живой человек ошибается два-три раза: не та раскладка, включённый Caps
 * Lock, старый пароль. Пять оставляют запас на это и не оставляют запаса на
 * перебор: 5 попыток за 15 минут — это 480 в сутки, тогда как без предела с
 * сотни машин их было бы 25 миллионов.
 */
const MAX_FAILURES_PER_EMAIL = 5;

/**
 * Двадцать неудач с одного IP за то же окно.
 *
 * Заметно свободнее, потому что один адрес — не один человек: офис, кафе,
 * мобильный оператор выпускают в интернет сотни людей через общий IP, и
 * строгий предел заблокировал бы весь офис из-за одного забывчивого
 * сотрудника. Двадцать — потолок, до которого нормальная общая сеть
 * доберётся едва ли, а «распыление» упрётся сразу.
 */
const MAX_FAILURES_PER_IP = 20;

export interface RateLimitVerdict {
  allowed: boolean;
  /** Через сколько секунд пробовать снова. Уходит в заголовок Retry-After. */
  retryAfterSeconds: number;
}

/**
 * Можно ли пробовать войти.
 *
 * Вызывается **до** проверки пароля: bcrypt намеренно дорог, и считать его
 * для заведомо отвергнутой попытки — значит дать атакующему бесплатный способ
 * нагружать сервер.
 *
 * Предел по адресу применяется одинаково и к существующим, и к выдуманным
 * адресам. Иначе он сам стал бы способом узнать, кто у нас зарегистрирован:
 * «этот отвечает 429, а этот 401 — значит, первый существует».
 */
export async function checkLoginRateLimit(
  email: string,
  ip: string | null,
): Promise<RateLimitVerdict> {
  const { rows } = await query<{
    email_failures: string;
    ip_failures: string;
    oldest_at: Date | null;
  }>(
    `select
       count(*) filter (where lower(email) = lower($1))            as email_failures,
       count(*) filter (where $2::inet is not null and ip = $2)    as ip_failures,
       min(created_at)                                             as oldest_at
     from login_attempts
     where not successful
       and created_at > now() - make_interval(mins => $3)
       and (lower(email) = lower($1) or ($2::inet is not null and ip = $2))`,
    [email, ip, WINDOW_MINUTES],
  );

  const row = rows[0];
  const emailFailures = Number(row.email_failures);
  const ipFailures = Number(row.ip_failures);

  if (emailFailures < MAX_FAILURES_PER_EMAIL && ipFailures < MAX_FAILURES_PER_IP) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Ждать нужно до того момента, когда самая старая неудача выпадет из окна,
  // — тогда счётчик станет меньше предела сам собой. Окно скользящее: оно не
  // сбрасывается разом, а «стекает», поэтому после ожидания открывается
  // ровно одна попытка, а не сразу пять.
  const oldest = row.oldest_at ? row.oldest_at.getTime() : Date.now();
  const unlockAt = oldest + WINDOW_MINUTES * 60_000;
  const retryAfterSeconds = Math.max(1, Math.ceil((unlockAt - Date.now()) / 1000));

  return { allowed: false, retryAfterSeconds };
}

/**
 * Записывает попытку.
 *
 * Удачный вход стирает накопленные неудачи по этому адресу: человек, который
 * ошибся четыре раза и вошёл с пятого, не должен остаться в шаге от блокировки
 * до конца окна.
 */
export async function recordLoginAttempt(
  email: string,
  ip: string | null,
  successful: boolean,
): Promise<void> {
  await query(
    `insert into login_attempts (email, ip, successful) values ($1, $2, $3)`,
    [email, ip, successful],
  );

  if (successful) {
    await query(
      `delete from login_attempts
        where not successful and lower(email) = lower($1)`,
      [email],
    );
  }
}

/**
 * Уборка журнала. Строки старше суток не нужны ни пределу (окно 15 минут),
 * ни разбору инцидента по свежим следам.
 */
export async function purgeOldLoginAttempts(olderThanHours = 24): Promise<number> {
  const { rowCount } = await query(
    `delete from login_attempts where created_at < now() - make_interval(hours => $1)`,
    [olderThanHours],
  );
  return rowCount ?? 0;
}

export { WINDOW_MINUTES, MAX_FAILURES_PER_EMAIL, MAX_FAILURES_PER_IP };
