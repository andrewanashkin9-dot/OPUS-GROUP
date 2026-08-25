import "server-only";

import { NextResponse } from "next/server";
import { readAccessCookie } from "./session";
import { verifyAccessToken, type UserRole } from "./tokens";

/**
 * Проверка прав на защищённых маршрутах.
 *
 * Главное правило: проверка стоит **в самом обработчике**, рядом с данными,
 * а не только в одном месте на входе. Проверка «где-то на подступах» рано
 * или поздно обходится: маршрут добавили и забыли внести в список, matcher
 * не совпал с путём, запрос пришёл не тем способом, который ожидали.
 * Обработчик, который сам спрашивает «кто ты и можно ли тебе», нельзя
 * обойти, забыв про него, — забыть можно только вместе с самим маршрутом.
 *
 * Использование:
 *
 *     export async function POST(request: Request) {
 *       const auth = await requireRole(["moderator", "admin"]);
 *       if (!auth.ok) return auth.response;   // 401 или 403
 *       // здесь auth.user точно есть и точно нужной роли
 *     }
 */

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  sessionId: string;
}

export type GuardResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: NextResponse };

/**
 * 401 — «я не знаю, кто ты» (токена нет, он просрочен или испорчен).
 * 403 — «я знаю, кто ты, но тебе нельзя».
 *
 * Разница не косметическая: на 401 клиент идёт обновлять токен и повторяет
 * запрос, на 403 повторять бессмысленно. Перепутанные коды дают либо
 * бесконечный цикл обновления, либо разлогинивание вместо «нет доступа».
 */
function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "unauthorized", message: "Требуется вход" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

function forbidden(): NextResponse {
  return NextResponse.json(
    { error: "forbidden", message: "Недостаточно прав" },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

/** Только «вошёл ли», без разбора роли. */
export async function requireUser(): Promise<GuardResult> {
  const token = await readAccessCookie();
  if (!token) return { ok: false, response: unauthorized() };

  const payload = await verifyAccessToken(token);
  if (!payload) return { ok: false, response: unauthorized() };

  return {
    ok: true,
    user: { id: payload.userId, role: payload.role, sessionId: payload.sessionId },
  };
}

/**
 * Вошёл **и** имеет одну из перечисленных ролей.
 *
 * Роль берётся из подписанного токена, а не из тела запроса и не из
 * заголовка: всё, что прислал клиент, клиент же может и подделать. Подпись
 * означает, что эту роль выдал наш сервер при входе.
 *
 * Цена решения — задержка: роль в токене «замораживается» на 15 минут, и
 * понижение прав доезжает не мгновенно (см. migrations/0002). Там, где
 * ждать нельзя — снятие блокировки, разжалование модератора, — роль нужно
 * перечитывать из базы прямо в обработчике.
 */
export async function requireRole(allowed: readonly UserRole[]): Promise<GuardResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  if (!allowed.includes(auth.user.role)) {
    return { ok: false, response: forbidden() };
  }
  return auth;
}
