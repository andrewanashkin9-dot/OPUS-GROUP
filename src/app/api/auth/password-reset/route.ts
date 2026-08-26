import { NextResponse } from "next/server";
import { noStore } from "@/lib/server/auth/http";
import { readJson } from "@/lib/server/auth/validate";
import { TooManyRequestsError, consumeToken, issueToken } from "@/lib/server/auth/email-tokens";
import { hashPassword, validatePassword } from "@/lib/server/auth/password";
import { findUserForLogin } from "@/lib/server/auth/users";
import { revokeAllSessions } from "@/lib/server/auth/session";
import { sendLetter } from "@/lib/server/mail/send";
import { query } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrl(request: Request): string {
  return process.env.APP_BASE_URL?.trim() || new URL(request.url).origin;
}

/**
 * Запросить письмо для сброса пароля.
 *
 * Отвечает одинаково всегда — и когда адрес найден, и когда нет. Иначе форма
 * «забыли пароль» превращается в справочник: перебирая адреса, можно узнать,
 * кто у нас зарегистрирован.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const email = typeof body.value.email === "string" ? body.value.email.trim() : "";
  if (!email) return NextResponse.json({ error: "Укажите почту" }, noStore(400));

  const same = { ok: true, message: "Если такой адрес есть, письмо отправлено" };

  try {
    const user = await findUserForLogin(email);
    // Заблокированному сбрасывать пароль незачем — но ответ тот же.
    if (!user || user.status !== "active" || !user.email) {
      return NextResponse.json(same, noStore(200));
    }

    const token = await issueToken(user.id, "password_reset");
    const link = `${baseUrl(request)}/reset-password?token=${token}`;

    await sendLetter({
      to: user.email,
      subject: "Смена пароля — OPUS GROUP",
      text: `Здравствуйте, ${user.displayName}!\n\nЧтобы задать новый пароль, перейдите по ссылке:\n${link}\n\nСсылка действует час и сработает один раз.\n\nЕсли вы не просили смену пароля — ничего делать не нужно, ваш нынешний пароль продолжает работать.`,
    });

    return NextResponse.json(same, noStore(200));
  } catch (error) {
    // Даже превышение лимита не выдаёт существование адреса: тот же ответ.
    if (error instanceof TooManyRequestsError) {
      return NextResponse.json(same, noStore(200));
    }
    console.error("[auth/password-reset]", error);
    return NextResponse.json({ error: "Не удалось обработать запрос" }, noStore(500));
  }
}

/** Задать новый пароль по ссылке из письма. */
export async function PUT(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const token = typeof body.value.token === "string" ? body.value.token : "";
  const password = typeof body.value.password === "string" ? body.value.password : "";

  if (!token) return NextResponse.json({ error: "Ссылка неполная" }, noStore(400));

  const passwordError = validatePassword(password);
  if (passwordError) return NextResponse.json({ error: passwordError }, noStore(400));

  const result = await consumeToken(token, "password_reset");
  if (!result) {
    return NextResponse.json({ error: "Ссылка недействительна или устарела" }, noStore(400));
  }

  await query(`update users set password_hash = $2 where id = $1`, [
    result.userId,
    await hashPassword(password),
  ]);

  // Все сессии закрываются. Пароль меняют в том числе тогда, когда его увели,
  // — и если чужой вход останется живым, смена пароля ничего не даст.
  await revokeAllSessions(result.userId);

  return NextResponse.json({ ok: true }, noStore(200));
}
