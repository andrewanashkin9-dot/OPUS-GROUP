import { NextResponse } from "next/server";
import { noStore } from "@/lib/server/auth/http";
import { isDbConfigured } from "@/lib/server/db-config";
import { query } from "@/lib/server/db";
import { isDemoMode } from "@/lib/demo-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ⚠️ ВРЕМЕННАЯ ДЕМО-ВСТАВКА — удалить перед запуском.
 *
 * Список демо-менеджеров для кнопки «Написать менеджеру».
 *
 * Отдаёт только имя, город и идентификатор — ни почты, ни телефона: это
 * витрина, а не выгрузка персональных данных, пусть и выдуманных.
 */
export async function GET() {
  if (!isDemoMode() || !isDbConfigured()) {
    return NextResponse.json({ managers: [] }, noStore(200));
  }

  try {
    const { rows } = await query<{ id: string; name: string; city: string | null }>(
      `select id, display_name as name, city
         from users
        where email like 'manager-%@demo.opusgroup' and status = 'active'
        order by display_name`,
    );
    return NextResponse.json({ managers: rows }, noStore(200));
  } catch (error) {
    console.error("[demo/managers]", error);
    return NextResponse.json({ managers: [] }, noStore(200));
  }
}
