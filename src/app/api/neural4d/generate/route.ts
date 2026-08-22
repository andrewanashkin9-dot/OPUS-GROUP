import { NextResponse } from "next/server";
import {
  getNeural4DConfig,
  neural4dAuthHeaders,
} from "@/lib/server/neural4d-config";

/**
 * Единственный канал между приложением и Neural4D.
 *
 * Браузер никогда не обращается к вендору напрямую — он присылает фотографии
 * сюда, а ключ добавляется здесь, на сервере. Поэтому ключ не появляется ни в
 * сетевой вкладке, ни в бандле, ни в истории браузера.
 *
 * Наружу не уходит ни ключ, ни тело ответа вендора: чужой ответ может
 * содержать наши же заголовки, внутренние адреса или отражённый запрос, и
 * пересылать его клиенту небезопасно. Клиент получает обобщённое сообщение,
 * подробности остаются в серверном логе — тоже без ключа.
 */

// Нужен Node-рантайм (загрузка файлов) и никакого кеширования ответов.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTOS = 4;
const MAX_BYTES_PER_PHOTO = 20 * 1024 * 1024; // 20 МБ, как обещает интерфейс
const VENDOR_TIMEOUT_MS = 120_000;

export async function POST(request: Request) {
  const config = getNeural4DConfig();

  // Ключа нет — это штатное состояние до подключения вендора, а не сбой:
  // сервер жив, запрос обработан, просто возможность выключена. Поэтому 200
  // с явным флагом, а не 5xx — иначе браузер писал бы красную ошибку в
  // консоль при каждом запуске демо, и то же самое летело бы в мониторинг
  // как инцидент. Клиент по этому флагу переключается на демо-модель.
  if (!config) {
    return NextResponse.json(
      { configured: false, reason: "not_configured" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Не удалось прочитать загруженные файлы." },
      { status: 400 },
    );
  }

  const photos = form.getAll("photos").filter((v): v is File => v instanceof File);

  if (photos.length === 0) {
    return NextResponse.json(
      { error: "Добавьте фотографии дома — без них модель не построить." },
      { status: 400 },
    );
  }
  if (photos.length > MAX_PHOTOS) {
    return NextResponse.json(
      { error: `Нужно не больше ${MAX_PHOTOS} фотографий.` },
      { status: 400 },
    );
  }
  for (const photo of photos) {
    if (photo.size > MAX_BYTES_PER_PHOTO) {
      return NextResponse.json(
        { error: "Каждый файл должен быть до 20 МБ. Уменьшите фото и попробуйте снова." },
        { status: 413 },
      );
    }
    if (!photo.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Подойдут только изображения — JPG или PNG." },
        { status: 415 },
      );
    }
  }

  const upstream = new FormData();
  for (const photo of photos) upstream.append("photos", photo, photo.name);

  try {
    const response = await fetch(`${config.apiUrl}/reconstruct`, {
      method: "POST",
      // Заголовки авторизации добавляются только здесь.
      headers: neural4dAuthHeaders(config),
      body: upstream,
      signal: AbortSignal.timeout(VENDOR_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Логируем статус, но не тело и не ключ.
      console.error(`[neural4d] вендор ответил ${response.status}`);
      return NextResponse.json(
        { error: "Сервис 3D-реконструкции временно недоступен. Попробуйте позже." },
        { status: 502 },
      );
    }

    // TODO: привести ответ вендора к SceneModel, когда будет известен его
    // формат. Схема ответа Neural4D пока недоступна, поэтому здесь нет
    // выдуманного маппинга — он молча ломал бы смету.
    const payload = await response.json();
    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error(
      `[neural4d] запрос не выполнен: ${timedOut ? "таймаут" : "сетевая ошибка"}`,
    );
    return NextResponse.json(
      {
        error: timedOut
          ? "Построение модели заняло слишком долго. Попробуйте ещё раз."
          : "Не удалось связаться с сервисом 3D-реконструкции.",
      },
      { status: 504 },
    );
  }
}
