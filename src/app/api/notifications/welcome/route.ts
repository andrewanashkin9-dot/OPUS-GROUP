import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { findWelcome } from "@/lib/server/notifications/queries";
import { welcomeText } from "@/lib/server/auth/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Приветствие.
 *
 * ⚠️ Показывается при **каждом заходе**, а не один раз после регистрации —
 * так попросили. Прежнее поведение возвращается двумя правками: `read_at is
 * null` в findWelcome и обратно «нет строки — нет карточки» здесь.
 *
 * Роль отдаётся вместе с ним из подписанного токена, а не берётся в браузере
 * из cookie: по роли карточка решает, куда ведёт кнопка «дальше», и cookie
 * здесь была бы способом подставить себе чужую ссылку. Мелочь, но бесплатная.
 *
 * Пометка «показано» — обычным `/api/notifications/[id]/read`: показать и
 * прочитать здесь одно и то же событие, и второго маршрута для него не нужно.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const stored = await findWelcome(auth.user.id);

  // У тех, кто зарегистрировался до появления приветствия, строки в базе
  // нет. Раз карточку теперь видят при каждом заходе, видеть её должны все —
  // поэтому текст для них собирается из роли на лету. Строка при этом не
  // создаётся: приветствие в ленте уведомлений задним числом выглядело бы
  // как событие, которого не было.
  const welcome = stored ?? {
    id: null,
    kind: "welcome" as const,
    text: welcomeText(auth.user.role),
    requestId: null,
    responseId: null,
    readAt: null,
    createdAt: new Date(),
  };

  return NextResponse.json({ welcome, role: auth.user.role }, noStore(200));
}
