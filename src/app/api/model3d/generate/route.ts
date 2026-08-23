import { NextResponse } from "next/server";
import { validateSceneModel } from "@/lib/3d/scene-model-schema";
import { getActiveVendor } from "@/lib/server/model3d";

/**
 * Единственный канал между приложением и вендорами 3D-реконструкции.
 *
 * Браузер шлёт фотографии сюда и не знает, кто их обрабатывает: Neural4D или
 * GenAPI. Выбор делает ACTIVE_3D_PROVIDER на сервере — так его нельзя
 * подменить из браузера, а вместе с ним и то, чей счёт будет оплачен.
 *
 * Наружу не уходят ни ключ, ни тело ответа вендора: чужой ответ может
 * отражать наши же заголовки. Клиент получает обобщённое сообщение,
 * подробности остаются в серверном логе — тоже без ключа.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_PHOTOS = 4;
const MAX_BYTES_PER_PHOTO = 20 * 1024 * 1024;
const VENDOR_TIMEOUT_MS = 120_000;

export async function POST(request: Request) {
  const vendor = getActiveVendor();

  // Ключа нет — штатное состояние до подключения вендора, а не сбой: сервер
  // жив, запрос обработан, возможность выключена. Поэтому 200 с флагом, а не
  // 5xx, иначе браузер писал бы красную ошибку при каждом запуске демо, и то
  // же самое летело бы в мониторинг как инцидент.
  if (!vendor.isConfigured()) {
    return NextResponse.json(
      { configured: false, reason: "not_configured", provider: vendor.id },
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

  try {
    const result = await vendor.requestReconstruction(
      photos,
      AbortSignal.timeout(VENDOR_TIMEOUT_MS),
    );

    if (!result.ok) {
      // В лог — вендор и статус, но не тело и не ключ.
      console.error(
        `[model3d] ${vendor.id}: ${result.kind === "not_json" ? "ответ не JSON" : `HTTP ${result.status}`}`,
      );
      return NextResponse.json(
        { error: "Сервис 3D-реконструкции временно недоступен. Попробуйте позже." },
        { status: 502 },
      );
    }

    // Ответ вендора приводится к нашей модели и проверяется, а не берётся на
    // веру: расхождение формата иначе доехало бы до сметы в виде NaN и
    // несуществующих поверхностей. Правила общие для всех вендоров.
    const validated = validateSceneModel(unwrapVendorPayload(result.payload), "photos");
    if (!validated.ok) {
      console.error(
        `[model3d] ${vendor.id}: ответ не соответствует модели: ${validated.problems.join("; ")}`,
      );
      return NextResponse.json(
        {
          error:
            "Модель пришла в неожиданном формате, мы не смогли её принять. Попробуйте ещё раз позже.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(validated.model, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error(
      `[model3d] ${vendor.id}: ${timedOut ? "таймаут" : "сетевая ошибка"}`,
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
 * Снимает обёртку, если вендор кладёт модель внутрь конверта.
 *
 * Контракты обоих вендоров не подтверждены — сеть наружу из песочницы
 * закрыта. Здесь разбираются только самые обычные варианты обёртки; если
 * реальный ответ устроен иначе, правка нужна ровно в этой функции. До правки
 * запрос честно завершится ошибкой, а не тихо испорченной сметой.
 */
function unwrapVendorPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  for (const key of ["model", "result", "data", "output"]) {
    if (key in payload) {
      return (payload as Record<string, unknown>)[key];
    }
  }
  return payload;
}
