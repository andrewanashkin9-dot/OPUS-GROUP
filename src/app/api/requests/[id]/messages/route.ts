import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { readJson } from "@/lib/server/auth/validate";
import { DomainError } from "@/lib/server/requests/queries";
import {
  countUnread,
  listMessages,
  markThreadRead,
  readThreadAccess,
  sendMessage,
} from "@/lib/server/messages/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Не константа ради константы: то же число проверяет база (миграция 0011). */
const MAX_BODY = 4000;

/**
 * Переписка по заявке.
 *
 * Доступ считается на сервере при каждом запросе, а не выводится из того,
 * что интерфейс показал кнопку. Посторонний получает 404, а не 403: 403
 * подтвердил бы, что такая заявка есть, и перебором адресов можно было бы
 * составить список чужих сделок.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/requests/[id]/messages">) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await readThreadAccess(id, auth.user.id);
  if (!access.canRead) return NextResponse.json({ error: "Заявка не найдена" }, noStore(404));

  // Порядок важен: сначала считаем непрочитанное, потом гасим. Иначе
  // ответ всегда сообщал бы ноль, и собеседник никогда не узнал бы, что
  // ему написали, пока он не смотрел.
  const unread = await countUnread(id, auth.user.id);
  const messages = await listMessages(id);
  await markThreadRead(id, auth.user.id);

  return NextResponse.json(
    { messages, unread, canWrite: access.canWrite, reason: access.reason },
    noStore(200),
  );
}

export async function POST(request: Request, ctx: RouteContext<"/api/requests/[id]/messages">) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const json = await readJson(request);
  if (!json.ok) return NextResponse.json({ error: json.error }, noStore(400));

  const body = typeof json.value.body === "string" ? json.value.body.trim() : "";
  if (!body) return NextResponse.json({ error: "Пустое сообщение" }, noStore(400));
  if (body.length > MAX_BODY) {
    return NextResponse.json({ error: `Не длиннее ${MAX_BODY} символов` }, noStore(400));
  }

  try {
    const message = await sendMessage({ requestId: id, authorId: auth.user.id, body });
    return NextResponse.json({ message }, noStore(201));
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, noStore(error.status));
    }
    console.error("[messages/send]", error);
    return NextResponse.json({ error: "Не удалось отправить сообщение" }, noStore(500));
  }
}
