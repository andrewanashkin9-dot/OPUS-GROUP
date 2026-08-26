import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { markRead } from "@/lib/server/notifications/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Пометить уведомление прочитанным.
 *
 * Владелец сверяется в самом UPDATE (`where user_id = $2`), а не отдельным
 * чтением: роль отвечает на вопрос «вошёл ли ты», но не на вопрос «твоё ли
 * это уведомление».
 */
export async function POST(_request: Request, context: RouteContext<"/api/notifications/[id]/read">) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  // Повторное «прочитано» — не ошибка: пользователь мог кликнуть дважды или
  // открыть уведомление на втором устройстве. Отвечаем одинаково.
  await markRead(auth.user.id, id);
  return NextResponse.json({ ok: true }, noStore(200));
}
