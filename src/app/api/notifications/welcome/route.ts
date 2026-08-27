import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { findUnseenWelcome } from "@/lib/server/notifications/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Приветствие, которое человек ещё не видел.
 *
 * Роль отдаётся вместе с ним из подписанного токена, а не берётся в браузере
 * из cookie: по роли карточка решает, куда ведёт кнопка «дальше», и cookie
 * здесь была бы способом подставить себе чужую ссылку. Мелочь, но бесплатная.
 *
 * Пометка «показано» — обычным `/api/notifications/[id]/read`: показать и
 * прочитать здесь одно и то же событие, и второго маршрута для него не нужно.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const welcome = await findUnseenWelcome(auth.user.id);
  return NextResponse.json({ welcome, role: auth.user.role }, noStore(200));
}
