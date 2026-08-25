import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth/guard";
import { findUserById } from "@/lib/server/auth/users";
import { noStore } from "@/lib/server/auth/http";

/** Кто я. Защищённый маршрут: доступен любому вошедшему, роль не важна. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  // Профиль читается из базы, а не берётся из токена: имя и статус могли
  // измениться после выдачи токена, и показывать устаревшее незачем.
  const user = await findUserById(auth.user.id);
  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "Требуется вход" }, noStore(401));
  }

  return NextResponse.json({ user }, noStore(200));
}
