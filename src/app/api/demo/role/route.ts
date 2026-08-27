import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth/guard";
import { noStore, requestMeta } from "@/lib/server/auth/http";
import { readJson } from "@/lib/server/auth/validate";
import { createSession, setSessionCookies } from "@/lib/server/auth/session";
import { query } from "@/lib/server/db";
import { isDemoMode } from "@/lib/demo-mode";
import type { UserRole } from "@/lib/server/auth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ⚠️ ВРЕМЕННАЯ ДЕМО-ВСТАВКА — удаляется одним коммитом (см. README).
 *
 * Смена собственной роли, чтобы раздел «Модерация» можно было открыть, не
 * правя базу руками.
 *
 * Это, разумеется, дыра: любой вошедший делает себя модератором. Поэтому
 * маршрут закрыт флагом DEMO_MODE и без него отвечает 404 — не 403.
 * 404 означает «такого маршрута нет», и по ответу нельзя узнать, что где-то
 * есть выключенная возможность повысить себе права.
 *
 * `admin` в списке нет: у него шире права, чем у модератора, и «на посмотреть»
 * он не нужен. Чем меньше умеет временный маршрут, тем меньше он стоит, если
 * про него забудут.
 */
const SWITCHABLE: UserRole[] = ["client", "executor", "moderator"];

export async function POST(request: Request) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "not_found" }, noStore(404));
  }

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const raw = (body.value as { role?: unknown }).role;
  const role = SWITCHABLE.find((r) => r === raw);
  if (!role) {
    return NextResponse.json({ error: "Такой роли переключать нельзя" }, noStore(400));
  }

  const { rowCount } = await query(
    `update users set role = $2::user_role where id = $1 and status = 'active'`,
    [auth.user.id, role],
  );
  if (rowCount === 0) {
    return NextResponse.json({ error: "Пользователь не найден" }, noStore(404));
  }

  // Роль лежит в подписанном токене и «заморожена» на 15 минут. Без новой
  // сессии переключение доехало бы только через четверть часа — за это время
  // человек успевает решить, что кнопка не работает.
  const meta = requestMeta(request);
  const session = await createSession(auth.user.id, role, meta);
  await setSessionCookies(session);

  return NextResponse.json({ role }, noStore(200));
}
