import "server-only";

import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookie-names";
import { query } from "../db";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  type UserRole,
} from "./tokens";

/**
 * Жизненный цикл сессии: выдать пару токенов, продлить, закрыть.
 *
 * Токены лежат в cookie, а не в localStorage. Разница решающая: cookie с
 * флагом httpOnly недоступен из JavaScript, поэтому чужой скрипт на
 * странице (XSS) не может его прочитать и унести. Токен в localStorage
 * читается одной строкой кода и уезжает вместе с любой уязвимостью в любой
 * подключённой библиотеке.
 */


/**
 * refresh-cookie отдаётся только на маршруты обновления и выхода. Браузер
 * не приложит его к остальным запросам — значит, длинный токен не мелькает
 * в каждом обращении к серверу и его негде случайно залогировать.
 */
const REFRESH_COOKIE_PATH = "/api/auth";

function cookieOptions(maxAgeSeconds: number, path = "/") {
  return {
    httpOnly: true,
    // Только по HTTPS. В разработке по http это отключается, иначе cookie
    // просто не установится и вход не заработает на localhost.
    secure: process.env.NODE_ENV === "production",
    // lax: cookie не уходит на чужие сайты при кросс-доменных запросах —
    // базовая защита от CSRF, когда стороння страница шлёт запрос от имени
    // залогиненного пользователя.
    sameSite: "lax" as const,
    path,
    maxAge: maxAgeSeconds,
  };
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

/**
 * Создаёт сессию: строку в auth_sessions и пару токенов.
 *
 * В базу уходит только хеш refresh-токена, сам токен возвращается наружу
 * один раз и больше нигде не хранится.
 */
export async function createSession(
  userId: string,
  role: UserRole,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<IssuedSession> {
  const refreshToken = generateRefreshToken();

  const { rows } = await query<{ id: string }>(
    `insert into auth_sessions (user_id, token_hash, expires_at, user_agent, ip)
     values ($1, $2, now() + make_interval(secs => $3), $4, $5)
     returning id`,
    [userId, hashRefreshToken(refreshToken), REFRESH_TOKEN_TTL_SECONDS, meta.userAgent ?? null, meta.ip ?? null],
  );

  const sessionId = rows[0].id;
  const accessToken = await signAccessToken({ userId, role, sessionId });

  return { accessToken, refreshToken, sessionId };
}

/**
 * Обновляет сессию по refresh-токену.
 *
 * Токен заменяется на новый при каждом обновлении (ротация). Смысл: если
 * старый токен утёк, у него есть окно только до ближайшего обновления —
 * дальше он не работает. Роль перечитывается из базы, поэтому понижение
 * прав или блокировка доезжают до пользователя в течение 15 минут.
 *
 * Возвращает null, если токен неизвестен, отозван, просрочен или
 * пользователь больше не активен.
 */
export async function rotateSession(refreshToken: string): Promise<IssuedSession | null> {
  const { rows } = await query<{
    id: string;
    user_id: string;
    role: UserRole;
    status: string;
  }>(
    `select s.id, s.user_id, u.role, u.status
       from auth_sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1
        and s.revoked_at is null
        and s.expires_at > now()`,
    [hashRefreshToken(refreshToken)],
  );

  const session = rows[0];
  if (!session || session.status !== "active") return null;

  const nextToken = generateRefreshToken();
  await query(
    `update auth_sessions
        set token_hash   = $2,
            expires_at   = now() + make_interval(secs => $3),
            last_used_at = now()
      where id = $1`,
    [session.id, hashRefreshToken(nextToken), REFRESH_TOKEN_TTL_SECONDS],
  );

  const accessToken = await signAccessToken({
    userId: session.user_id,
    role: session.role,
    sessionId: session.id,
  });

  return { accessToken, refreshToken: nextToken, sessionId: session.id };
}

/** Закрывает одну сессию. Строка остаётся — по ней видно, когда вышли. */
export async function revokeSession(refreshToken: string): Promise<void> {
  await query(
    `update auth_sessions set revoked_at = now()
      where token_hash = $1 and revoked_at is null`,
    [hashRefreshToken(refreshToken)],
  );
}

/** «Выйти на всех устройствах», а также блокировка пользователя. */
export async function revokeAllSessions(userId: string): Promise<number> {
  const { rowCount } = await query(
    `update auth_sessions set revoked_at = now()
      where user_id = $1 and revoked_at is null`,
    [userId],
  );
  return rowCount ?? 0;
}

// ── cookie ────────────────────────────────────────────────────────────────

export async function setSessionCookies(session: IssuedSession): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, session.accessToken, cookieOptions(ACCESS_TOKEN_TTL_SECONDS));
  store.set(
    REFRESH_COOKIE,
    session.refreshToken,
    cookieOptions(REFRESH_TOKEN_TTL_SECONDS, REFRESH_COOKIE_PATH),
  );
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  // maxAge: 0 — браузеру сказано забыть cookie немедленно.
  store.set(ACCESS_COOKIE, "", cookieOptions(0));
  store.set(REFRESH_COOKIE, "", cookieOptions(0, REFRESH_COOKIE_PATH));
}

export async function readAccessCookie(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}

export async function readRefreshCookie(): Promise<string | null> {
  return (await cookies()).get(REFRESH_COOKIE)?.value ?? null;
}
