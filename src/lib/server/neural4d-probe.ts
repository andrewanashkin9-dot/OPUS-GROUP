// Ключ читается только на сервере. Импорт из клиентского компонента должен
// ломать сборку, а не тихо уносить ключ в браузерный бандл.
import "server-only";

import { getNeural4DConfig, neural4dAuthHeaders } from "./neural4d-config";

/**
 * ВРЕМЕННО. Удаляется вместе со страницей `/diag-7f4a2c91/neural4d`, как
 * только подтверждён настоящий адрес и формат ответа Neural4D.
 *
 * Проба связи с вендором. Задача одна: получить улику вместо догадки —
 * какой адрес существует, принят ли ключ, что именно приходит в теле.
 * По одному «генерация не работает» неотличимы неверный ключ,
 * несуществующий путь и лежащий сервис; здесь видно, какой из трёх.
 *
 * Что здесь сознательно НЕ делается:
 *  - ключ не возвращается наружу ни при каких условиях: в результат едет
 *    только его длина, чтобы отличить пустую строку от настоящего значения;
 *  - адрес вендора берётся исключительно из окружения, никогда из запроса —
 *    иначе это открытый прокси с нашим ключом в заголовке (SSRF);
 *  - тела запросов подобраны так, чтобы не запускать платную генерацию:
 *    в них нет изображения, и настоящий эндпоинт ответит отказом по валидации
 *    раньше, чем спишет кредиты.
 */

const TIMEOUT_MS = 20_000;
const BODY_LIMIT = 1200;

export interface ProbeResult {
  /** Полный адрес, по которому ушёл запрос. Секретов в нём нет. */
  url: string;
  /** Зачем этот адрес в списке — читается вместе с ответом. */
  note: string;
  /** null, если до ответа дело не дошло (DNS, TLS, таймаут). */
  status: number | null;
  statusText: string;
  /** Начало тела ответа либо текст сетевой ошибки. */
  body: string;
  /** Тип содержимого — по нему видно, HTML это от прокси или JSON вендора. */
  contentType: string;
}

export interface ProbeReport {
  /** Есть ли ключ в окружении. Само значение не возвращается никогда. */
  keyConfigured: boolean;
  keyLength: number;
  /** База и путь, которыми пользуется приложение прямо сейчас. */
  apiUrl: string;
  reconstructPath: string;
  results: ProbeResult[];
  /** Когда проба выполнялась — на планшете вкладку легко перепутать со старой. */
  ranAt: string;
}

/**
 * Адреса-кандидаты.
 *
 * Первый — тот, которым пользуется приложение: он в списке, чтобы
 * подтвердить или опровергнуть, что дело именно в нём. Остальные — из
 * документации вендора, где генерация асинхронная: в ответ приходит не
 * модель, а uuid, по которому потом опрашивают retrieveModel.
 */
const CANDIDATES: { path: string; body: unknown; note: string }[] = [
  {
    path: "",
    body: null,
    note: "путь из настроек приложения — тот самый запрос, который делает генерация",
  },
  {
    path: "/api/generateModelWithImage",
    body: { prompt: "house exterior" },
    note: "из документации вендора: изображение → 3D",
  },
  {
    path: "/api/generateModelWithText",
    body: { prompt: "house exterior" },
    note: "из документации вендора: текст → 3D",
  },
  {
    path: "/api/retrieveModel",
    body: { uuid: "probe" },
    note: "из документации вендора: опрос готовности",
  },
];

const COOLDOWN_MS = 30_000;

// Живёт в памяти процесса и умирает вместе с ним. Это не кеш, а тормоз:
// адрес страницы открыт, и если ссылку куда-нибудь перешлют, она не должна
// превращаться в кнопку «стучать к вендору без остановки». Держится здесь,
// а не в компоненте страницы: запись в переменную модуля во время рендера —
// побочный эффект, и правила React справедливо на неё ругаются.
let last: { at: number; report: ProbeReport } | null = null;

/**
 * Проба с выдержкой: свежий результат, но не чаще раза в полминуты.
 */
export async function probeNeural4DThrottled(): Promise<ProbeReport> {
  const now = Date.now();
  if (last && now - last.at < COOLDOWN_MS) return last.report;
  const report = await probeNeural4D();
  last = { at: Date.now(), report };
  return report;
}

export async function probeNeural4D(): Promise<ProbeReport> {
  const config = getNeural4DConfig();

  if (!config) {
    return {
      keyConfigured: false,
      keyLength: 0,
      apiUrl: process.env.NEURAL4D_API_URL?.trim() ?? "(не задан)",
      reconstructPath: process.env.NEURAL4D_RECONSTRUCT_PATH?.trim() ?? "(не задан)",
      results: [],
      ranAt: new Date().toISOString(),
    };
  }

  // База в документации — `https://api.neural4d.com/v1`, а пути начинаются
  // с `/api/...`. Склеить их можно двумя способами, и гадать не нужно:
  // неправильный ответит 404, правильный — чем-нибудь другим.
  const origin = safeOrigin(config.apiUrl);
  const bases = origin && origin !== config.apiUrl ? [config.apiUrl, origin] : [config.apiUrl];

  const targets = CANDIDATES.flatMap(({ path, body, note }) =>
    // Путь приложения проверяется только на своей базе: он и есть «как
    // настроено», вторая сборка адреса для него бессмысленна.
    (path === "" ? [config.apiUrl] : bases).map((base) => ({
      url: `${base}${path === "" ? config.reconstructPath : path}`,
      body,
      note,
    })),
  );

  const results: ProbeResult[] = [];
  for (const target of targets) {
    results.push(await probeOne(target, neural4dAuthHeaders(config)));
  }

  return {
    keyConfigured: true,
    keyLength: config.apiKey.length,
    apiUrl: config.apiUrl,
    reconstructPath: config.reconstructPath,
    results,
    ranAt: new Date().toISOString(),
  };
}

async function probeOne(
  target: { url: string; body: unknown; note: string },
  auth: HeadersInit,
): Promise<ProbeResult> {
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: {
        ...auth,
        ...(target.body ? { "content-type": "application/json" } : {}),
      },
      // Для пути приложения тело не отправляется намеренно: нас интересует,
      // существует ли адрес вообще, а 404 приходит раньше разбора тела.
      body: target.body ? JSON.stringify(target.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    return {
      url: target.url,
      note: target.note,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type") ?? "(не указан)",
      body: await peek(response),
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : String(error);
    return {
      url: target.url,
      note: target.note,
      status: null,
      statusText: "",
      contentType: "",
      body: `запрос не выполнен — ${name}: ${message}`,
    };
  }
}

async function peek(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return "(пустое тело)";
    return text.length > BODY_LIMIT ? `${text.slice(0, BODY_LIMIT)}…` : text;
  } catch {
    return "(тело прочитать не удалось)";
  }
}

/** URL из окружения может быть написан с опечаткой — это не повод падать. */
function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
