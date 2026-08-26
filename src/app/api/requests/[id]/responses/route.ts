import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { readJson } from "@/lib/server/auth/validate";
import { DomainError, createResponse } from "@/lib/server/requests/queries";
import { parseCreateResponse } from "@/lib/server/requests/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Отклик на заявку. Только исполнитель. */
export async function POST(request: Request, ctx: RouteContext<"/api/requests/[id]/responses">) {
  const auth = await requireRole(["executor"]);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const input = parseCreateResponse(body.value);
  if (!input.ok) return NextResponse.json({ error: input.error }, noStore(400));

  try {
    const created = await createResponse({
      requestId: id,
      executorId: auth.user.id,
      ...input.value,
    });
    return NextResponse.json({ response: created }, noStore(201));
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, noStore(error.status));
    }
    console.error("[responses/create]", error);
    return NextResponse.json({ error: "Не удалось отправить отклик" }, noStore(500));
  }
}
