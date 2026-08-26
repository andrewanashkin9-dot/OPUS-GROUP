import "server-only";

import { query } from "../db";
import { hashPassword } from "./password";
import type { UserRole } from "./tokens";

/** Всё, что можно безопасно показать наружу. Хеш пароля сюда не входит. */
export interface PublicUser {
  id: string;
  role: UserRole;
  status: "pending" | "active" | "blocked" | "deleted";
  email: string | null;
  displayName: string;
  city: string | null;
  createdAt: Date;
  /** null — адрес не подтверждён. Нужно, чтобы напомнить об этом в кабинете. */
  emailVerifiedAt: Date | null;
}

/** Строка целиком, включая хеш. Не покидает серверный код. */
interface UserRow extends Omit<PublicUser, "createdAt"> {
  passwordHash: string | null;
  createdAt: Date;
}

const PUBLIC_COLUMNS = `
  id,
  role,
  status,
  email,
  display_name as "displayName",
  city,
  created_at        as "createdAt",
  email_verified_at as "emailVerifiedAt"
`;

export async function findUserForLogin(email: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `select ${PUBLIC_COLUMNS}, password_hash as "passwordHash"
       from users
      where lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const { rows } = await query<PublicUser>(
    `select ${PUBLIC_COLUMNS} from users where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export class EmailTakenError extends Error {
  constructor() {
    super("Этот адрес уже зарегистрирован");
  }
}

/**
 * Создаёт пользователя.
 *
 * Занятость адреса не проверяется отдельным запросом «есть ли такой» —
 * между проверкой и вставкой успевает вклиниться параллельная регистрация,
 * и оба запроса решают, что адрес свободен. Вместо этого вставка делается
 * сразу, а уникальность гарантирует индекс в базе; ошибку 23505 (нарушение
 * уникальности) превращаем в понятную. База — единственное место, где такая
 * проверка действительно атомарна.
 */
export async function createUser(input: {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  city?: string | null;
}): Promise<PublicUser> {
  const passwordHash = await hashPassword(input.password);

  try {
    const { rows } = await query<PublicUser>(
      `insert into users (email, password_hash, display_name, role, city, status)
       values ($1, $2, $3, $4, $5, 'active')
       returning ${PUBLIC_COLUMNS}`,
      [input.email, passwordHash, input.displayName, input.role, input.city ?? null],
    );
    return rows[0];
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      throw new EmailTakenError();
    }
    throw error;
  }
}
