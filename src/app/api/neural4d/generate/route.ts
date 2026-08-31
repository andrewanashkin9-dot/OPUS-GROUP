import { NextResponse } from "next/server";
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
const PROMPT = "exterior of a residential house, photorealistic, full building";
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

  // Ключ есть, но вендор заглушён вручную. Проверка стоит после ключа, а не
  // до него, чтобы причина в ответе была правдой: «disabled» при пустом
  // окружении отвечало бы «мы это отключили» там, где на самом деле нечего
  // включать.
  if (!isNeural4DEnabled()) {
    return NextResponse.json(
      { configured: false, reason: "disabled" },
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

  // Вендор принимает одно изображение в поле `image` — это подтверждено его
  // же ответом: 400 «Image file is required, path: image». Четыре стороны он
  // не принимает вовсе, поэтому уходит фасад, снятый первым; остальные три
  // снимка остаются у нас и нужны обмерам, а не вендору.
  const upstream = new FormData();
  upstream.append("image", photos[0], photos[0].name);
  upstream.append("prompt", PROMPT);

  const endpoint = `${config.apiOrigin}${config.generatePath}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      // Заголовки авторизации добавляются только здесь.
      headers: neural4dAuthHeaders(config),
      body: upstream,
      signal: AbortSignal.timeout(VENDOR_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Раньше в журнал уходил один статус — «вендор ответил 404», и всё.
      // По такой записи неотличимы неверный ключ, несуществующий адрес и
      // упавший сервис, а именно это и нужно знать первым делом. Теперь
      // пишется ещё и путь, и начало ответа: там лежит текст ошибки вендора.
      // Ключа в этой строке нет — он живёт только в заголовке запроса.
      const body = await peek(response);
      console.error(
        `[neural4d] POST ${endpoint} -> ${response.status} ${response.statusText}; ${body}`,
      );
      // Исчерпанный баланс — не поломка сервиса, и предлагать «попробуйте
      // позже» тут значит врать: само по себе позже оно не заработает.
      const outOfPoints = response.status === 403 && /insufficient points/i.test(body);
      return NextResponse.json(
        {
          reason: outOfPoints ? "out_of_points" : "unavailable",
          error: outOfPoints
            ? "На счёте сервиса 3D закончились баллы — внешний вид дома не построить, пока баланс не пополнят."
            : "Сервис 3D временно недоступен — дом показан схемой.",
        },
        { status: 502 },
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      console.error(`[neural4d] ответ ${endpoint} не является JSON`);
      return NextResponse.json(
        { error: "Сервис вернул неожиданный ответ. Мы уже разбираемся." },
        { status: 502 },
      );
    }

    // Успешный ответ Neural4D — не модель, а номер задания: генерация у него
    // асинхронная, готовность потом опрашивают через retrieveModel. И это
    // всё, что от него приходит: меш, то есть внешний вид. Ни метров, ни
    // этажей, ни площадей поверхностей в ответе нет вовсе, поэтому смета
    // считается не отсюда, а по габаритам, которые вводит человек.
    const uuid = jobUuid(payload);
    if (uuid) {
      return NextResponse.json(
        { uuid },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    console.error(
      `[neural4d] ${endpoint} ответил 200, но без номера задания: ${JSON.stringify(payload).slice(0, 400)}`,
    );
    return NextResponse.json(
      { error: "Сервис вернул неожиданный ответ. Мы уже разбираемся." },
      { status: 502 },
    );
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    // Причина сетевого отказа — DNS, отказ в соединении, TLS — тоже в журнал:
    // без неё «сетевая ошибка» одинаково означает опечатку в адресе и
    // недоступный сервис.
    const cause = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(
      `[neural4d] POST ${endpoint} не выполнен (${timedOut ? "таймаут" : "сетевая ошибка"}): ${cause}`,
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
 * Начало ответа вендора — для журнала.
 *
 * Обрезано: в теле ошибки бывает и трассировка на сотню строк, а нужен
 * первый абзац, в котором вендор называет причину.
 */
async function peek(response: Response, limit = 400): Promise<string> {
  try {
    const text = await response.text();
    return text.length > limit ? `${text.slice(0, limit)}…` : text || "(пустое тело)";
  } catch {
    return "(тело прочитать не удалось)";
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
/**
 * Номер задания из ответа вендора.
 *
 * Он приходит и строкой, и массивом из одной строки — форма зависит от
 * эндпоинта, поэтому разбираются обе, а всё остальное считается «номера
 * нет», а не «номер, наверное, где-то тут».
 */
function jobUuid(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("uuid" in payload)) return null;
  const raw = (payload as { uuid: unknown }).uuid;
  if (typeof raw === "string" && raw) return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0]) return raw[0];
  return null;
}
