import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { readJson } from "@/lib/server/auth/validate";
import {
  ModerationError,
  applyModerationAction,
  listUserHistory,
} from "@/lib/server/moderation/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** История решений по пользователю: она же объяснение, почему он ограничен. */
export async function GET(_request: Request, ctx: RouteContext<"/api/moderation/users/[id]">) {
  const auth = await requireRole(["moderator", "admin"]);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  return NextResponse.json({ history: await listUserHistory(id) }, noStore(200));
}

const ACTIONS = ["approve", "block", "unblock"] as const;

/** Решение модератора. Без причины запрос не проходит. */
export async function POST(request: Request, ctx: RouteContext<"/api/moderation/users/[id]">) {
  const auth = await requireRole(["moderator", "admin"]);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const action = body.value.action;
  if (typeof action !== "string" || !(ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: "Неизвестное действие" }, noStore(400));
  }
  const reason = typeof body.value.reason === "string" ? body.value.reason : "";

  try {
    const result = await applyModerationAction({
      actorId: auth.user.id,
      targetId: id,
      action: action as (typeof ACTIONS)[number],
      reason,
    });
    return NextResponse.json({ status: result.status }, noStore(200));
  } catch (error) {
    if (error instanceof ModerationError) {
      return NextResponse.json({ error: error.message }, noStore(error.status));
    }
    console.error("[moderation]", error);
    return NextResponse.json({ error: "Не удалось применить решение" }, noStore(500));
  }
}
