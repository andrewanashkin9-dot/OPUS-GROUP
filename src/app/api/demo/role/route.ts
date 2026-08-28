import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth/guard";
import { noStore, requestMeta } from "@/lib/server/auth/http";
import { readJson } from "@/lib/server/auth/validate";
import { createSession, setSessionCookies } from "@/lib/server/auth/session";
import { query } from "@/lib/server/db";
import { isDbConfigured } from "@/lib/server/db-config";
import { cookies } from "next/headers";
import { ROLE_COOKIE } from "@/lib/auth/cookie-names";
import type { UserRole } from "@/lib/server/auth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TODO: удалить перед запуском — временная демо-вставка.
 *
 * Смена собственной роли, чтобы раздел «Модерация» можно было открыть, не
 * правя базу руками.
 *
 * ⚠️ Маршрут работает всегда: выключателя у него нет по прямой просьбе.
 * Это значит, что **любой вошедший на боевом сайте может сделать себя
 * модератором** — открыть чужие анкеты и блокировать людей. Убирается это
 * не настройкой, а удалением файла: маршрут, кнопка в кабинете
 * (DemoRoleSwitch) и плашка в углу (DemoModeCorner).
 *
 * `admin` в списке нет: у него шире права, чем у модератора, и «на посмотреть»
 * он не нужен. Чем меньше умеет временный маршрут, тем меньше он стоит, если
 * про него забудут.
 */
const SWITCHABLE: UserRole[] = ["client", "executor", "moderator"];

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const raw = (body.value as { role?: unknown }).role;
  const role = SWITCHABLE.find((r) => r === raw);
  if (!role) {
    return NextResponse.json({ error: "Такой роли переключать нельзя" }, noStore(400));
  }

  // TODO: удалить перед запуском — переключение без базы.
  //
  // Пользователей нет, менять роль некому, и сессии тоже нет. Пишем только
  // cookie-подсказку для интерфейса: по ней меню решает, показывать ли
  // «Модерацию». Правами это не распоряжается — распоряжаться нечем, все
  // защищённые данные лежат в базе, которой нет.
  if (!isDbConfigured()) {
    const store = await cookies();
    store.set(ROLE_COOKIE, role, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });
    return NextResponse.json({ role, offline: true }, noStore(200));
  }

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

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
