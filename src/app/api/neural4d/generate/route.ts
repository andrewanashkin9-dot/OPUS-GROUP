import { NextResponse } from "next/server";
import { validateSceneModel } from "@/lib/3d/scene-model-schema";
import {
  getNeural4DConfig,
  isNeural4DEnabled,
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

const REQUIRED_PHOTOS = 4;
const MAX_BYTES_PER_PHOTO = 20 * 1024 * 1024; // 20 МБ, как обещает интерфейс
const VENDOR_TIMEOUT_MS = 120_000;

export async function POST(request: Request) {
  // Вендор намеренно выключен на время работы над дизайном: генерация сразу
  // отдаёт шаблонный дом, ничего не ждёт и ничего не тратит. Проверка стоит
  // раньше всех остальных — даже читать ключ незачем.
  if (!isNeural4DEnabled()) {
    return NextResponse.json(
      { configured: false, reason: "disabled" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

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

  // Ровно четыре стороны. По двум-трём снимкам реконструкция достроит
  // недостающие стены догадкой, а смета посчитает их как настоящие.
  if (photos.length !== REQUIRED_PHOTOS) {
    return NextResponse.json(
      {
        error: `Нужно ровно ${REQUIRED_PHOTOS} фотографии — по одной с каждой стороны дома. Сейчас: ${photos.length}.`,
      },
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

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      console.error("[neural4d] ответ вендора не является JSON");
      return NextResponse.json(
        { error: "Сервис вернул неожиданный ответ. Мы уже разбираемся." },
        { status: 502 },
      );
    }

    // Ответ вендора приводится к нашей модели и проверяется, а не берётся на
    // веру: расхождение формата иначе доехало бы до сметы в виде NaN и
    // несуществующих поверхностей.
    const result = validateSceneModel(mapVendorPayload(payload), "photos");
    if (!result.ok) {
      // Список полей — в лог, наружу общее сообщение: он описывает наш
      // внутренний формат, и посетителю от него пользы нет.
      console.error(
        `[neural4d] ответ не соответствует модели: ${result.problems.join("; ")}`,
      );
      return NextResponse.json(
        {
          error:
            "Модель пришла в неожиданном формате, мы не смогли её принять. Попробуйте ещё раз позже.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(result.model, {
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

/**
 * Единственное место, где формат Neural4D превращается в наш.
 *
 * Схема ответа вендора пока не подтверждена, поэтому здесь нет выдуманного
 * маппинга: payload передаётся как есть и проходит проверку. Если реальный
 * ответ окажется вложенным (например, `{ model: {...} }`) или назовёт поля
 * иначе, правка нужна ровно здесь — остальной код трогать не придётся, а до
 * правки запрос честно завершится ошибкой, а не тихо испорченной сметой.
 */
function mapVendorPayload(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "model" in payload) {
    return (payload as { model: unknown }).model;
  }
  return payload;
}
