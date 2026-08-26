import { NextResponse } from "next/server";
import { createSession, setSessionCookies } from "@/lib/server/auth/session";
import { EmailTakenError, createUser } from "@/lib/server/auth/users";
import { parseRegister, readJson } from "@/lib/server/auth/validate";
import { requestMeta, noStore } from "@/lib/server/auth/http";

/** Регистрация. Сразу выдаёт сессию — иначе человек после неё войдёт руками. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const input = parseRegister(body.value);
  if (!input.ok) return NextResponse.json({ error: input.error }, noStore(400));

  try {
    const user = await createUser(input.value);
    const session = await createSession(user.id, user.role, requestMeta(request));
    await setSessionCookies(session);

    return NextResponse.json({ user }, noStore(201));
  } catch (error) {
    if (error instanceof EmailTakenError) {
      // 409 Conflict, а не 400: запрос корректен, конфликтует состояние.
      return NextResponse.json({ error: error.message }, noStore(409));
    }
    // Наружу не уходит ни текст ошибки базы, ни стек: там бывают имена
    // таблиц, фрагменты запроса и значения полей.
    console.error("[auth/register]", error);
    return NextResponse.json({ error: "Не удалось зарегистрировать" }, noStore(500));
  }
}
