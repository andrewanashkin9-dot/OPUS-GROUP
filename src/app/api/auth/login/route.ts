import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/server/auth/password";
import { createSession, setSessionCookies } from "@/lib/server/auth/session";
import { findUserForLogin } from "@/lib/server/auth/users";
import { parseLogin, readJson } from "@/lib/server/auth/validate";
import { checkLoginRateLimit, recordLoginAttempt } from "@/lib/server/auth/rate-limit";
import { requestMeta, noStore } from "@/lib/server/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const input = parseLogin(body.value);
  if (!input.ok) return NextResponse.json({ error: input.error }, noStore(400));

  const meta = requestMeta(request);

  try {
    // Предел проверяется до bcrypt: он намеренно дорог, и считать его для
    // заведомо отвергнутой попытки — бесплатный способ нагрузить сервер.
    const limit = await checkLoginRateLimit(input.value.email, meta.ip);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Слишком много попыток входа. Попробуйте позже.",
          retryAfterSeconds: limit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            // Стандартный заголовок: клиент по нему знает, сколько ждать,
            // и не долбится в закрытую дверь.
            "Retry-After": String(limit.retryAfterSeconds),
          },
        },
      );
    }

    const user = await findUserForLogin(input.value.email);

    // Пароль проверяется даже когда пользователя нет: verifyPassword в этом
    // случае считает хеш-пустышку. Иначе несуществующий адрес отвечал бы
    // заметно быстрее существующего, и по времени ответа перебором
    // выясняется, кто у нас зарегистрирован.
    const passwordOk = await verifyPassword(input.value.password, user?.passwordHash ?? null);

    // Один и тот же ответ на «нет такого адреса», «неверный пароль» и
    // «учётная запись заблокирована». Разные сообщения — подсказка тому,
    // кто перебирает: он узнаёт, что адрес угадан верно.
    if (!user || !passwordOk || user.status !== "active") {
      await recordLoginAttempt(input.value.email, meta.ip, false);
      return NextResponse.json({ error: "Неверная почта или пароль" }, noStore(401));
    }

    await recordLoginAttempt(input.value.email, meta.ip, true);

    const session = await createSession(user.id, user.role, meta);
    await setSessionCookies(session);

    // Хеш пароля не должен уехать в ответ даже случайно, поэтому наружу
    // собирается новый объект из явно перечисленных полей, а не «всё, кроме».
    return NextResponse.json(
      {
        user: {
          id: user.id,
          role: user.role,
          status: user.status,
          email: user.email,
          displayName: user.displayName,
          city: user.city,
          createdAt: user.createdAt,
        },
      },
      noStore(200),
    );
  } catch (error) {
    console.error("[auth/login]", error);
    return NextResponse.json({ error: "Не удалось войти" }, noStore(500));
  }
}
