import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth/guard";
import { query } from "@/lib/server/db";
import { noStore } from "@/lib/server/auth/http";

/**
 * Пример защищённого по роли маршрута: список людей, ждущих модерации.
 *
 * Образец для всех будущих защищённых обработчиков — первые две строки тела
 * одинаковые везде. Пока их не написали, обработчик открыт всем; написали —
 * закрыт независимо от того, что настроено снаружи.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRole(["moderator", "admin"]);
  if (!auth.ok) return auth.response;

  const { rows } = await query(
    `select id, role, status, email, display_name as "displayName", city,
            created_at as "createdAt"
       from users
      where status = 'pending'
      order by created_at
      limit 100`,
  );

  return NextResponse.json({ users: rows }, noStore(200));
}
