import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { DomainError, acceptResponse } from "@/lib/server/requests/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Клиент принимает отклик: заявка уходит «в работу», остальные отклики
 * отклоняются. Роль проверяется здесь, право на конкретную заявку — в
 * запросе к базе: клиент вообще ≠ владелец этой заявки.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/responses/[id]/accept">) {
  const auth = await requireRole(["client"]);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    await acceptResponse(id, auth.user.id);
    return NextResponse.json({ ok: true }, noStore(200));
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, noStore(error.status));
    }
    console.error("[responses/accept]", error);
    return NextResponse.json({ error: "Не удалось принять отклик" }, noStore(500));
  }
}
