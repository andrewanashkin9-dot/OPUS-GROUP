import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { readJson } from "@/lib/server/auth/validate";
import { DomainError, changeRequestStatus } from "@/lib/server/requests/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Завершение и отмена заявки — оба только владельцем.
 *
 * Подтверждает выполнение именно клиент, а не исполнитель: иначе исполнителю
 * достаточно было бы нажать «готово», чтобы работа считалась принятой.
 */
const ALLOWED = ["completed", "cancelled"] as const;
type Target = (typeof ALLOWED)[number];

export async function POST(request: Request, ctx: RouteContext<"/api/requests/[id]/status">) {
  const auth = await requireRole(["client"]);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const status = body.value.status;
  if (typeof status !== "string" || !(ALLOWED as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: "Через этот маршрут можно только завершить или отменить заявку" },
      noStore(400),
    );
  }

  try {
    await changeRequestStatus(id, auth.user.id, status as Target);
    return NextResponse.json({ ok: true }, noStore(200));
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, noStore(error.status));
    }
    console.error("[requests/status]", error);
    return NextResponse.json({ error: "Не удалось изменить статус" }, noStore(500));
  }
}
