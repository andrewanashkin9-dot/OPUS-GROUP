import { NextResponse } from "next/server";
import {
  clearSessionCookies,
  readRefreshCookie,
  rotateSession,
  setSessionCookies,
} from "@/lib/server/auth/session";
import { noStore } from "@/lib/server/auth/http";

/**
 * Продление сессии. Клиент зовёт этот маршрут, получив 401, и повторяет
 * исходный запрос. Роль при этом перечитывается из базы — так блокировка и
 * смена роли доезжают до пользователя.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const refreshToken = await readRefreshCookie();
  if (!refreshToken) {
    return NextResponse.json({ error: "Требуется вход" }, noStore(401));
  }

  try {
    const session = await rotateSession(refreshToken);
    if (!session) {
      // Токен отозван, просрочен или пользователь заблокирован. Cookie
      // чистятся, иначе браузер будет ходить сюда с мёртвым токеном вечно.
      await clearSessionCookies();
      return NextResponse.json({ error: "Сессия недействительна" }, noStore(401));
    }

    await setSessionCookies(session);
    return NextResponse.json({ ok: true }, noStore(200));
  } catch (error) {
    console.error("[auth/refresh]", error);
    return NextResponse.json({ error: "Не удалось продлить сессию" }, noStore(500));
  }
}
