// Ключ читается только на сервере. Импорт из клиентского компонента должен
// ломать сборку, а не тихо уносить ключ в браузерный бандл.
import "server-only";

import type { ProbeResult } from "../neural4d-probe-result";
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

// Форма ответа объявлена в отдельном модуле без `server-only`: её должен
// знать и клиентский компонент, который рисует результат.
export type { ProbeResult };

export interface ProbeReport {
  /** Есть ли ключ в окружении. Само значение не возвращается никогда. */
  keyConfigured: boolean;
  keyLength: number;
  /** Адреса, которыми пользуется приложение прямо сейчас. */
  apiOrigin: string;
  generatePath: string;
  retrievePath: string;
  results: ProbeResult[];
  /** Когда проба выполнялась — на планшете вкладку легко перепутать со старой. */
  ranAt: string;
}

/**
 * Настоящая генерация — с настоящим файлом и настоящими баллами.
 *
 * Отделена от проб выше сознательно: те намеренно неполные и ничего не
 * стоят, а эта тратит баланс. Вызывается только по явному нажатию, никогда
 * при открытии страницы.
 */
export async function runLiveGeneration(
  image: File,
  prompt: string,
): Promise<ProbeResult> {
  const config = getNeural4DConfig();
  if (!config) {
    return offline("(генерация)", "ключ не задан — обращаться некуда");
  }

  const body = new FormData();
  body.append("image", image, image.name || "photo.jpg");
  body.append("prompt", prompt);

  return rawCall(
    `${config.apiOrigin}${config.generatePath}`,
    { method: "POST", headers: neural4dAuthHeaders(config), body },
    "настоящая генерация: фотография в поле image",
    // Загрузка снимка с телефона по мобильной сети бывает медленной, и
    // двадцати секунд на неё не хватает.
    60_000,
  );
}

/**
 * Как называется параметр «сколько вариантов».
 *
 * Вендор по умолчанию ставит четыре задания за запрос и списывает 120
 * баллов. Нужен один — но имя параметра неизвестно, а угадывать его правкой
 * кода мы уже пробовали на `/reconstruct` и потеряли на этом время.
 *
 * Здесь оно выясняется опытом, и опыт бесплатный. Запрос уходит без файла:
 * валидатор вендора отбивает его раньше, чем начнётся генерация, — это уже
 * проверено, именно так приходит «Image file is required». Но отвечает он
 * сразу обо ВСЕХ полях, которые не прошли проверку. Значит, если приложить
 * поле с заведомо негодным значением и оно окажется в списке ошибок — такое
 * поле у вендора есть. Если не окажется — такого поля он не знает.
 *
 * `faceNum` в списке — контрольный: это поле точно существует, вендор сам
 * вернул его в `generationConfig`. Если жалобы нет даже на него, значит
 * опыт ничего не показывает (вендор проверяет только файл), и это тоже
 * результат — надо идти в документацию, а не гадать дальше.
 */
export async function probeVariantParam(): Promise<ProbeResult> {
  const config = getNeural4DConfig();
  if (!config) return offline("(подбор параметра)", "ключ не задан");

  const body = new FormData();
  // Заведомо негодное значение: отрицательное количество не бывает.
  const BAD = "-1";
  for (const name of [
    "faceNum", // контроль: поле точно существует
    "num",
    "count",
    "n",
    "quantity",
    "modelNum",
    "modelCount",
    "variantNum",
    "variantCount",
    "variants",
    "batchSize",
    "generateNum",
    "resultNum",
  ]) {
    body.append(name, BAD);
  }

  return rawCall(
    `${config.apiOrigin}${config.generatePath}`,
    { method: "POST", headers: neural4dAuthHeaders(config), body },
    "подбор имени параметра: без файла, поэтому баллы не тратятся",
  );
}

/** Опрос готовности по номеру задания. */
export async function runRetrieve(uuid: string): Promise<ProbeResult> {
  const config = getNeural4DConfig();
  if (!config) {
    return offline("(опрос)", "ключ не задан — обращаться некуда");
  }

  return rawCall(
    `${config.apiOrigin}${config.retrievePath}`,
    {
      method: "POST",
      headers: { ...neural4dAuthHeaders(config), "content-type": "application/json" },
      body: JSON.stringify({ uuid }),
    },
    "опрос готовности по номеру задания",
  );
}

/**
 * Ответ вендора целиком, без разбора.
 *
 * Разбирать здесь нечего: имена полей у готовой модели мы как раз и хотим
 * увидеть. Обрезка длиннее обычной — ссылка на меш может стоять в конце
 * длинного объекта, и потерять её было бы обидно.
 */
async function rawCall(
  url: string,
  init: RequestInit,
  note: string,
  timeoutMs = TIMEOUT_MS,
): Promise<ProbeResult> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const text = await response.text();
    return {
      url,
      note,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type") ?? "(не указан)",
      body: text
        ? text.length > LIVE_BODY_LIMIT
          ? `${text.slice(0, LIVE_BODY_LIMIT)}…`
          : text
        : "(пустое тело)",
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : String(error);
    return offline(url, `запрос не выполнен — ${name}: ${message}`, note);
  }
}

function offline(url: string, body: string, note = ""): ProbeResult {
  return { url, note, status: null, statusText: "", contentType: "", body };
}

const LIVE_BODY_LIMIT = 4000;

/**
 * Что проверяется.
 *
 * Раньше здесь перебирались восемь вариантов адреса — надо было выяснить,
 * какой из них существует. Выяснили: сегмента `/v1` у вендора нет, работают
 * `/api/generateModelWithImage` и `/api/retrieveModel`. Поэтому список
 * сократился до двух адресов, которыми приложение теперь и пользуется, и
 * страница отвечает на другой вопрос — «отвечают ли они сейчас».
 *
 * Тела намеренно неполные: без файла настоящий эндпоинт отвечает отказом по
 * валидации и не запускает платную генерацию.
 */
const CANDIDATES: { path: "generate" | "retrieve"; body: unknown; note: string }[] = [
  {
    path: "generate",
    body: { prompt: "house exterior" },
    note: "постановка задания — сюда уходит фото при генерации",
  },
  {
    path: "retrieve",
    body: { uuid: "probe" },
    note: "опрос готовности по номеру задания",
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
      apiOrigin: process.env.NEURAL4D_API_URL?.trim() ?? "(не задан)",
      generatePath: "(нет ключа)",
      retrievePath: "(нет ключа)",
      results: [],
      ranAt: new Date().toISOString(),
    };
  }

  const targets = CANDIDATES.map(({ path, body, note }) => ({
    url: `${config.apiOrigin}${path === "generate" ? config.generatePath : config.retrievePath}`,
    body,
    note,
  }));

  const results: ProbeResult[] = [];
  for (const target of targets) {
    results.push(await probeOne(target, neural4dAuthHeaders(config)));
  }

  return {
    keyConfigured: true,
    keyLength: config.apiKey.length,
    apiOrigin: config.apiOrigin,
    generatePath: config.generatePath,
    retrievePath: config.retrievePath,
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
