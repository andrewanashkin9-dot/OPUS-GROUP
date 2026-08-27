import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { listUsers, type UserStatus } from "@/lib/server/moderation/queries";

/** Список пользователей для модерации. Каждый показ пишется в журнал 152-ФЗ. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["pending", "active", "blocked", "all"] as const;

export async function GET(request: Request) {
  const auth = await requireRole(["moderator", "admin"]);
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;
  const rawStatus = params.get("status") ?? "all";
  const status = (STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as UserStatus | "all")
    : "all";

  const users = await listUsers({
    actorId: auth.user.id,
    status,
    search: params.get("q"),
  });

  return NextResponse.json({ users }, noStore(200));
}
