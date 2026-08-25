import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

/**
 * Выдача и проверка токенов.
 *
 * Access-токен — JWT: строка из трёх частей, где третья часть это подпись
 * секретом, который есть только у сервера. Поэтому сервер может доверять
 * содержимому токена, не заглядывая в базу: подделать подпись без секрета
 * нельзя, а любая правка содержимого её ломает.
 *
 * Важно понимать, чем JWT не является: **это не шифрование**. Содержимое
 * читается кем угодно — достаточно раскодировать base64. Подпись защищает
 * от подмены, но не от чтения. Поэтому внутрь кладут только id и роль, и
 * никогда — почту, телефон или что-либо, что нельзя показывать.
 */

export type UserRole = "client" | "executor" | "moderator" | "admin";

export const USER_ROLES: readonly UserRole[] = ["client", "executor", "moderator", "admin"];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/**
 * Пятнадцать минут — компромисс. Короче: пользователь чаще ходит за
 * обновлением. Длиннее: столько же держится доступ у заблокированного,
 * потому что отозвать выданный JWT невозможно (см. migrations/0002).
 */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Тридцать дней без входа — и придётся вводить пароль заново. */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const ISSUER = "opus-group";
const AUDIENCE = "opus-group-app";

export interface AccessTokenPayload {
  userId: string;
  role: UserRole;
  /** id строки в auth_sessions: по нему видно, какой сессией выдан токен. */
  sessionId: string;
}

/**
 * Секрет подписи. Читается из окружения при каждом обращении, а не при
 * загрузке модуля: иначе забытая переменная роняла бы всё приложение на
 * старте, включая страницы, которым авторизация не нужна.
 *
 * Минимум 32 символа — для HS256 короткий секрет перебирается.
 */
function getSecret(): Uint8Array {
  const raw = process.env.AUTH_JWT_SECRET?.trim();
  if (!raw) {
    throw new Error(
      "Не задан AUTH_JWT_SECRET. Сгенерировать: openssl rand -base64 48",
    );
  }
  if (raw.length < 32) {
    throw new Error("AUTH_JWT_SECRET короче 32 символов — такой секрет перебирается");
  }
  return new TextEncoder().encode(raw);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role, sid: payload.sessionId })
    .setProtectedHeader({ alg: "HS256" })
    // sub — стандартное поле «о ком токен».
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecret());
}

/**
 * Проверяет подпись и срок. Возвращает null на любой неудаче — вызывающей
 * стороне незачем знать, токен просрочен, подделан или это вообще не токен:
 * разные ответы подсказывали бы атакующему, что он делает правильно.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      // Список разрешённых алгоритмов обязателен. Без него токен с
      // alg: "none" или подписанный по другой схеме может быть принят —
      // это классическая дыра библиотек JWT.
      algorithms: ["HS256"],
    });

    const { sub, role, sid } = payload;
    if (typeof sub !== "string" || typeof sid !== "string" || !isUserRole(role)) {
      return null;
    }
    return { userId: sub, role, sessionId: sid };
  } catch {
    return null;
  }
}

/**
 * Refresh-токен — просто 32 случайных байта, без всякой структуры.
 *
 * Структура ему не нужна: он ничего о себе не рассказывает, а всё
 * необходимое лежит в строке auth_sessions, найденной по его хешу. Зато
 * такой токен невозможно подделать и можно отозвать — чего JWT не умеет.
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/** В базе лежит только этот хеш — см. комментарий в migrations/0002. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Сравнение хешей за постоянное время.
 *
 * Обычное `===` останавливается на первом несовпавшем символе, и по времени
 * ответа можно посимвольно подобрать значение. Здесь сравнение всегда
 * занимает одинаковое время.
 */
export function refreshTokenMatches(candidateHash: string, storedHash: string): boolean {
  const a = Buffer.from(candidateHash, "utf8");
  const b = Buffer.from(storedHash, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
