import { NextResponse } from "next/server";
import { requireRole, requireUser } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { readJson } from "@/lib/server/auth/validate";
import { createRequest, listClientRequests, listOpenRequests } from "@/lib/server/requests/queries";
import { parseCreateRequest } from "@/lib/server/requests/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Список заявок. Что именно в нём — зависит от роли спрашивающего. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id, role } = auth.user;

  // Модератор и админ смотрят глазами клиента на свои же заявки: отдельная
  // выдача «все заявки всех» появится вместе с экраном модерации, а до тех
  // пор незачем открывать маршрут, которым ещё никто не пользуется.
  const requests =
    role === "executor" ? await listOpenRequests(id) : await listClientRequests(id);

  return NextResponse.json({ requests }, noStore(200));
}

/** Создание заявки. Только клиент. */
export async function POST(request: Request) {
  const auth = await requireRole(["client"]);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const input = parseCreateRequest(body.value);
  if (!input.ok) return NextResponse.json({ error: input.error }, noStore(400));

  try {
    const created = await createRequest({ clientId: auth.user.id, ...input.value });
    return NextResponse.json({ request: created }, noStore(201));
  } catch (error) {
    console.error("[requests/create]", error);
    return NextResponse.json({ error: "Не удалось создать заявку" }, noStore(500));
  }
}
