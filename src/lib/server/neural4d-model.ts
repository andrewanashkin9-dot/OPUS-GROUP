import "server-only";

import { getNeural4DConfig, neural4dAuthHeaders } from "./neural4d-config";

/**
 * Готовность модели у Neural4D и ссылка на неё.
 *
 * Генерация асинхронная: сначала задание, потом опрос. Коды подтверждены
 * живыми ответами со стенда:
 *
 *    1 — «The generation is in progress.»
 *    0 — готово
 *   -2 — «This UUID does not exist.»
 */

const TIMEOUT_MS = 20_000;

export type ModelStatus = "pending" | "ready" | "failed";

export interface ModelState {
  status: ModelStatus;
  /** Адрес меша у вендора. Наружу не отдаётся — только через наш маршрут. */
  url?: string;
  /** Что сказал вендор — для журнала и для честного сообщения человеку. */
  message?: string;
}

export async function fetchModelState(uuid: string): Promise<ModelState> {
  const config = getNeural4DConfig();
  if (!config) return { status: "failed", message: "вендор не подключён" };

  let payload: unknown;
  try {
    const response = await fetch(`${config.apiOrigin}${config.retrievePath}`, {
      method: "POST",
      headers: {
        ...neural4dAuthHeaders(config),
        "content-type": "application/json",
      },
      body: JSON.stringify({ uuid }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`[neural4d] retrieveModel -> ${response.status}`);
      return { status: "failed", message: `вендор ответил ${response.status}` };
    }
    payload = await response.json();
  } catch (error) {
    const cause = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[neural4d] retrieveModel не выполнен: ${cause}`);
    return { status: "failed", message: "нет связи с сервисом" };
  }

  const code = codeStatus(payload);
  if (code === 1) return { status: "pending" };
  if (code !== 0) {
    return { status: "failed", message: messageOf(payload) ?? `код ${code}` };
  }

  const url = modelUrlField(payload) ?? findModelUrl(payload);
  if (!url) {
    // Не догадка о схеме, а честный отказ: модель готова, но ссылки в ответе
    // не нашлось. Полное тело — в журнал, оттуда видно, как её назвали.
    console.error(
      `[neural4d] модель готова, но ссылки в ответе нет: ${JSON.stringify(payload).slice(0, 800)}`,
    );
    return { status: "failed", message: "в ответе нет ссылки на модель" };
  }

  return { status: "ready", url };
}

/**
 * Забирает сам файл модели.
 *
 * Через нас, а не напрямую из браузера, по двум причинам. Во-первых, чужой
 * CDN не обязан разрешать нам кросс-доменные запросы, и загрузка молча
 * падала бы на CORS. Во-вторых, ссылка вендора подписана и живёт своей
 * жизнью — отдавать её в браузер значит отдавать наружу кусок нашего
 * доступа к его хранилищу.
 *
 * Без заголовка авторизации, и это исправление, а не небрежность. Ссылка
 * приходит уже подписанной — в ней есть `?sign=…`, ровно как у
 * `uploadedImageUrl` в ответе на генерацию. Хранилища, раздающие такие
 * ссылки, считают подпись в адресе и заголовок Authorization двумя разными
 * способами представиться и на запрос с обоими отвечают отказом. Мы клали
 * туда наш ключ — и файл не скачивался, а на экране просто не появлялась
 * модель.
 */
export async function fetchModelFile(url: string) {
  return fetch(url, {
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
}

function codeStatus(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { codeStatus?: unknown }).codeStatus;
  return typeof raw === "number" ? raw : null;
}

function messageOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { message?: unknown }).message;
  return typeof raw === "string" ? raw : null;
}

/**
 * Ссылка из документированного поля `modelUrl`.
 *
 * Читается первой: так написано в описании retrieveModel у вендора —
 * дождаться `codeStatus == 0` и взять `modelUrl` с файлом .glb. Поиск ниже
 * остаётся страховкой на случай, если поле переименуют или завернут глубже.
 */
function modelUrlField(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { modelUrl?: unknown }).modelUrl;
  return typeof raw === "string" && /^https?:\/\//i.test(raw) ? raw : null;
}

/** Расширения, по которым узнаётся трёхмерная модель. glb — первый выбор. */
const MODEL_EXTENSIONS = [".glb", ".gltf", ".fbx", ".obj", ".usdz", ".ply"];

/**
 * Ищет ссылку на модель, обходя ответ целиком.
 *
 * Страховка к `modelUrl` выше: документированное поле читается первым, а
 * этот обход срабатывает, если ответ окажется вложенным или поле назовут
 * иначе. Адрес узнаётся по себе: строка, начинающаяся с http и несущая
 * расширение трёхмерного формата — в пути или в имени файла внутри подписи.
 *
 * Так разбор переживает и переименование поля, и вложенность, и появление
 * рядом обложки в png — картинка под условие не подходит.
 */
export function findModelUrl(payload: unknown): string | null {
  const found: string[] = [];

  const walk = (value: unknown, depth: number): void => {
    if (depth > 6) return;
    if (typeof value === "string") {
      if (looksLikeModelUrl(value)) found.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    if (value && typeof value === "object") {
      for (const item of Object.values(value)) walk(item, depth + 1);
    }
  };

  walk(payload, 0);
  if (found.length === 0) return null;

  // glb — один файл со всей геометрией и текстурами, остальные форматы
  // тянут за собой соседние файлы, которых у нас нет.
  return found.find((url) => extensionOf(url) === ".glb") ?? found[0];
}

function looksLikeModelUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  if (MODEL_EXTENSIONS.includes(extensionOf(value))) return true;
  // Расширения в пути может не быть вовсе: подписанные ссылки часто прячут
  // имя файла в `response-content-disposition=…filename=дом.glb`. Проверять
  // только хвост пути значило бы не найти готовую модель там, где она есть.
  return MODEL_EXTENSIONS.some((ext) =>
    new RegExp(`filename[^&]*\\${ext}(?:["']|&|$)`, "i").test(value),
  );
}

/** Расширение без учёта подписи в query: ссылки вендора приходят с `?sign=…`. */
function extensionOf(url: string): string {
  const path = url.split(/[?#]/)[0].toLowerCase();
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot);
}
