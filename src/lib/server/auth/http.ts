import "server-only";

/** Мелочи, общие для маршрутов авторизации. */

/**
 * Ответы авторизации не кешируются нигде и никогда. Кеш на промежуточном
 * сервере, отдавший чужой профиль следующему посетителю, — классическая и
 * очень дорогая ошибка.
 */
export function noStore(status: number) {
  return { status, headers: { "Cache-Control": "no-store" } };
}

/**
 * Откуда пришёл вход — для списка активных сессий.
 *
 * IP берётся из x-forwarded-for, потому что приложение стоит за обратным
 * прокси (Vercel), и адрес самого соединения всегда будет адресом прокси.
 * Заголовок подделывается кем угодно, поэтому годится только для показа
 * человеку и никогда — для проверки прав.
 */
export function requestMeta(request: Request): { userAgent: string | null; ip: string | null } {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || null;
  return { userAgent: request.headers.get("user-agent"), ip };
}
