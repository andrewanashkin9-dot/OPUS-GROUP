import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { findRequest, listResponses } from "@/lib/server/requests/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Одна заявка с откликами.
 *
 * Кто что видит:
 *  - владелец — заявку целиком и все отклики, ему по ним выбирать;
 *  - исполнитель — заявку и **только свой** отклик: чужие цены это чужая
 *    коммерческая информация, по ней подстраивают собственную;
 *  - посторонний — ничего.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/requests/[id]">) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const found = await findRequest(id);
  // Нет заявки и нет доступа — один ответ. Иначе перебором id выясняется,
  // какие заявки существуют.
  if (!found) return NextResponse.json({ error: "Заявка не найдена" }, noStore(404));

  const isOwner = found.clientId === auth.user.id;
  const responses = await listResponses(id);

  if (!isOwner) {
    const own = responses.filter((r) => r.executorId === auth.user.id);
    // Посторонний не увидит даже саму заявку, если она не в общей ленте.
    if (own.length === 0 && found.status !== "published") {
      return NextResponse.json({ error: "Заявка не найдена" }, noStore(404));
    }
    return NextResponse.json({ request: found, responses: own, isOwner: false }, noStore(200));
  }

  return NextResponse.json({ request: found, responses, isOwner: true }, noStore(200));
}
