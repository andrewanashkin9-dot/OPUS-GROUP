import { NextResponse } from "next/server";
import { clearSessionCookies, readRefreshCookie, revokeSession } from "@/lib/server/auth/session";
import { noStore } from "@/lib/server/auth/http";

/**
 * Выход. Cookie чистятся всегда, даже если токена не было: «выйти» обязано
 * срабатывать при любом состоянии, иначе человек останется залогиненным на
 * чужом компьютере из-за ошибки, которую он никак не увидит.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const refreshToken = await readRefreshCookie();

  if (refreshToken) {
    try {
      // Отзыв в базе обязателен: без него унесённый refresh-токен продолжит
      // работать ещё месяц, сколько бы cookie ни чистили в браузере.
      await revokeSession(refreshToken);
    } catch (error) {
      console.error("[auth/logout]", error);
    }
  }

  await clearSessionCookies();
  return NextResponse.json({ ok: true }, noStore(200));
}
