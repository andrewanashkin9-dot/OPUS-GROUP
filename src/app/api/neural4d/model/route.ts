import { NextResponse } from "next/server";
import { fetchModelState } from "@/lib/server/neural4d-model";

/**
 * Готова ли модель у вендора.
 *
 * Опрос идёт по одному запросу на вызов, а ждать готовности в цикле здесь
 * нельзя: модель строится минутами, а серверная функция на хостинге живёт
 * меньше — ожидание внутри неё оборвалось бы по таймауту, ничего не отдав.
 * Поэтому ждёт браузер, а этот маршрут отвечает на один вопрос за раз.
 *
 * Наружу не уходит ни ключ, ни подписанная ссылка вендора: файл забирается
 * соседним маршрутом, тоже через нас.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const uuid = new URL(request.url).searchParams.get("uuid")?.trim();
  if (!uuid) {
    return NextResponse.json({ error: "Не указан номер задания." }, { status: 400 });
  }

  const state = await fetchModelState(uuid);

  return NextResponse.json(
    {
      status: state.status,
      message: state.message,
      // Адрес у вендора подписан и наружу не отдаётся — вместо него свой.
      url: state.status === "ready" ? `/api/neural4d/mesh?uuid=${encodeURIComponent(uuid)}` : undefined,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
