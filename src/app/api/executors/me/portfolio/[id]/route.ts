import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { deletePortfolioItem } from "@/lib/server/profiles/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/executors/me/portfolio/[id]">,
) {
  const auth = await requireRole(["executor"]);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const removed = await deletePortfolioItem(auth.user.id, id);
  // Чужая работа и несуществующая — один ответ: иначе перебором id можно
  // узнать, какие записи вообще есть.
  if (!removed) return NextResponse.json({ error: "Работа не найдена" }, noStore(404));

  return NextResponse.json({ ok: true }, noStore(200));
}
