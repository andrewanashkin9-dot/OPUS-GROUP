import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { readJson } from "@/lib/server/auth/validate";
import { TooManyRequestsError, consumeToken, issueToken } from "@/lib/server/auth/email-tokens";
import { findUserById } from "@/lib/server/auth/users";
import { sendLetter } from "@/lib/server/mail/send";
import { query } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrl(request: Request): string {
  return process.env.APP_BASE_URL?.trim() || new URL(request.url).origin;
}

/** Запросить письмо со ссылкой подтверждения. Только для себя. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const user = await findUserById(auth.user.id);
  if (!user?.email) {
    return NextResponse.json({ error: "У вас не указана почта" }, noStore(400));
  }
  if (user.status !== "active") return NextResponse.json({ error: "Требуется вход" }, noStore(401));

  try {
    const token = await issueToken(user.id, "email_verification");
    const link = `${baseUrl(request)}/verify-email?token=${token}`;

    const { delivered } = await sendLetter({
      to: user.email,
      subject: "Подтверждение адреса — OPUS GROUP",
      text: `Здравствуйте, ${user.displayName}!\n\nПодтвердите адрес, перейдя по ссылке:\n${link}\n\nСсылка действует сутки. Если вы не регистрировались — просто не переходите по ней.`,
    });

    return NextResponse.json({ ok: true, delivered }, noStore(200));
  } catch (error) {
    if (error instanceof TooManyRequestsError) {
      return NextResponse.json({ error: error.message }, noStore(429));
    }
    console.error("[auth/verify-email]", error);
    return NextResponse.json({ error: "Не удалось отправить письмо" }, noStore(500));
  }
}

/** Подтвердить адрес по ссылке из письма. Вход не нужен: токен и есть доказательство. */
export async function PUT(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const token = typeof body.value.token === "string" ? body.value.token : "";
  if (!token) return NextResponse.json({ error: "Ссылка неполная" }, noStore(400));

  const result = await consumeToken(token, "email_verification");
  // Просрочена, уже использована, подделана — один ответ. Разные сообщения
  // подсказывали бы подбирающему, что он на верном пути.
  if (!result) {
    return NextResponse.json({ error: "Ссылка недействительна или устарела" }, noStore(400));
  }

  await query(
    `update users set email_verified_at = now() where id = $1 and email_verified_at is null`,
    [result.userId],
  );

  return NextResponse.json({ ok: true }, noStore(200));
}
