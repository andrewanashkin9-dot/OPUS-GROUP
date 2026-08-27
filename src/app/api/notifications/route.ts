import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { listNotifications, markAllRead } from "@/lib/server/notifications/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Колокольчик: счётчик непрочитанных и последние уведомления. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  // Роль здесь не проверяется намеренно: уведомления есть у всех, а
  // принадлежность выбирается по id из подписанного токена — чужие в выдачу
  // не попадают в принципе, потому что запроса «покажи чужие» не существует.
  const { unread, items } = await listNotifications(auth.user.id);
  return NextResponse.json({ unread, notifications: items }, noStore(200));
}

/** «Прочитать все». */
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const count = await markAllRead(auth.user.id);
  return NextResponse.json({ read: count }, noStore(200));
}
