import { NextResponse } from "next/server";
import { fetchModelFile, fetchModelState } from "@/lib/server/neural4d-model";
import { getNeural4DConfig } from "@/lib/server/neural4d-config";

/**
 * Сам файл модели, отданный через нас.
 *
 * Браузер не ходит к вендору напрямую: его CDN не обязан разрешать нам
 * кросс-доменные запросы, и загрузка молча падала бы на CORS. Заодно
 * подписанная ссылка вендора не покидает сервер.
 *
 * Адрес принимается только номером задания, никогда самим адресом. Иначе
 * маршрут стал бы открытым прокси: любой желающий заставил бы наш сервер
 * ходить куда угодно, в том числе во внутреннюю сеть, да ещё с нашим
 * ключом в заголовке.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const uuid = new URL(request.url).searchParams.get("uuid")?.trim();
  if (!uuid) {
    return NextResponse.json({ error: "Не указан номер задания." }, { status: 400 });
  }

  if (!getNeural4DConfig()) {
    return NextResponse.json({ error: "Сервис 3D не подключён." }, { status: 503 });
  }

  const state = await fetchModelState(uuid);
  if (state.status !== "ready" || !state.url) {
    return NextResponse.json(
      { error: state.status === "pending" ? "Модель ещё строится." : "Модель недоступна." },
      { status: state.status === "pending" ? 409 : 502 },
    );
  }

  const upstream = await fetchModelFile(state.url);
  if (!upstream.ok || !upstream.body) {
    console.error(`[neural4d] файл модели не отдан: ${upstream.status}`);
    return NextResponse.json({ error: "Не удалось получить файл модели." }, { status: 502 });
  }

  // Тело переливается потоком, а не через буфер: меш бывает в десятки
  // мегабайт, и складывать его целиком в память функции незачем.
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "model/gltf-binary",
      // Готовая модель не меняется, но ссылка вендора подписана и истекает,
      // поэтому кешируется ненадолго и только у клиента.
      "Cache-Control": "private, max-age=300",
    },
  });
}
