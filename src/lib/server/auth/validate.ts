import "server-only";

import { MIN_PASSWORD_LENGTH, validatePassword } from "./password";
import { isUserRole, type UserRole } from "./tokens";

/**
 * Разбор тела запроса.
 *
 * Всё, что пришло от клиента, считается враждебным, пока не проверено:
 * тело может быть не JSON, поля — не строками, роль — любой выдуманной.
 * Проект уже проверяет так ответ вендора (src/lib/3d/scene-model-schema.ts);
 * здесь тот же подход.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Роли, которые можно указать при самостоятельной регистрации. */
const SELF_SIGNUP_ROLES: readonly UserRole[] = ["client", "executor"];

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  city: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

export async function readJson(request: Request): Promise<Parsed<Record<string, unknown>>> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return { ok: false, error: "Тело запроса должно быть объектом JSON" };
    }
    return { ok: true, value: body as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Тело запроса не является корректным JSON" };
  }
}

export function parseRegister(body: Record<string, unknown>): Parsed<RegisterInput> {
  const email = asString(body.email);
  if (!email || !email.includes("@") || email.length > 254) {
    return { ok: false, error: "Укажите корректный адрес почты" };
  }

  const password = typeof body.password === "string" ? body.password : "";
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError };

  const displayName = asString(body.displayName);
  if (!displayName || displayName.length > 120) {
    return { ok: false, error: "Укажите имя (до 120 символов)" };
  }

  // Роль приходит от клиента, поэтому список разрешённых — закрытый.
  // Без него достаточно было бы прислать role: "admin" при регистрации.
  const role = body.role === undefined ? "client" : body.role;
  if (!isUserRole(role) || !SELF_SIGNUP_ROLES.includes(role)) {
    return { ok: false, error: "Роль может быть только client или executor" };
  }

  const city = asString(body.city);

  return { ok: true, value: { email, password, displayName, role, city: city || null } };
}

export function parseLogin(body: Record<string, unknown>): Parsed<LoginInput> {
  const email = asString(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || password.length === 0) {
    return { ok: false, error: "Укажите почту и пароль" };
  }
  return { ok: true, value: { email, password } };
}

export { MIN_PASSWORD_LENGTH };
