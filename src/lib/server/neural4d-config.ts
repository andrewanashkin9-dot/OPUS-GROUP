// Сборка падает, если этот модуль импортируют из клиентского компонента.
// Это не соглашение, а машинная гарантия: ключ физически не может уехать
// в браузерный бандл через случайный импорт.
import "server-only";

/**
 * Доступ к секретам Neural4D. Единственное место во всём проекте, которое
 * читает ключ.
 *
 * Правила, которые здесь соблюдаются:
 *  - ключ читается только из process.env на сервере;
 *  - имя переменной не имеет префикса NEXT_PUBLIC_, поэтому Next никогда
 *    не подставит её в клиентский бандл;
 *  - значение никогда не логируется, не возвращается наружу и не попадает
 *    в текст ошибки — наружу уходит только факт «настроен / не настроен».
 */

const DEFAULT_API_URL = "https://api.neural4d.com";

/**
 * Эндпоинты вендора. Больше не догадки — проверены живыми запросами со
 * стенда (см. историю страницы-пробы):
 *
 *   POST https://api.neural4d.com/v1/reconstruct
 *        → 404 «Cannot POST /v1/reconstruct» — такого адреса нет вовсе,
 *          и это и есть причина, по которой генерация не работала при
 *          живом ключе;
 *   POST https://api.neural4d.com/api/generateModelWithImage
 *        → 400 {"errors":[{"msg":"Image file is required","path":"image"}]}
 *          — адрес существует, ключ принят, ждёт файл в поле `image`;
 *   POST https://api.neural4d.com/api/retrieveModel
 *        → 200 {"codeStatus":-2,"message":"This UUID does not exist."}
 *          — адрес существует, отвечает штатно.
 *
 * Отсюда два вывода, зашитых ниже: сегмента `/v1` у этих адресов нет, и
 * генерация асинхронная — сначала задание, потом опрос готовности.
 */
const DEFAULT_GENERATE_PATH = "/api/generateModelWithImage";
const DEFAULT_RETRIEVE_PATH = "/api/retrieveModel";

/** Ведущий слэш обязателен, хвостовой — нет: иначе получится `//` в URL. */
function normalizePath(path: string): string {
  const withLead = path.startsWith("/") ? path : `/${path}`;
  return withLead.replace(/\/+$/, "");
}

export interface Neural4DConfig {
  apiKey: string;
  /**
   * Только схема и хост, без пути.
   *
   * Берётся именно origin, а не значение переменной целиком, и это
   * сознательно: в окружении стенда стоит `https://api.neural4d.com/v1`,
   * а эндпоинты вендора живут в корне. Склейка с этим `/v1` и давала
   * `Cannot POST /v1/...`. Отрезая путь здесь, мы чиним адрес и там, где
   * переменную уже прописали с хвостом, — без похода в настройки Vercel.
   */
  apiOrigin: string;
  /** Постановка задания: multipart с файлом в поле `image`. */
  generatePath: string;
  /** Опрос готовности по uuid, выданному генерацией. */
  retrievePath: string;
}

/**
 * Возвращает конфигурацию, либо null, если ключ не задан.
 *
 * null — не ошибка: без ключа приложение продолжает работать на mock-провайдере,
 * поэтому пустой .env не ломает разработку.
 */
export function getNeural4DConfig(): Neural4DConfig | null {
  const apiKey = process.env.NEURAL4D_API_KEY?.trim();
  if (!apiKey) return null;

  // Адрес вендора берётся только из окружения. Если бы его присылал клиент,
  // эндпоинт стал бы открытым прокси — можно было бы заставить сервер ходить
  // во внутреннюю сеть и приложить к запросу наш ключ (SSRF).
  const raw = process.env.NEURAL4D_API_URL?.trim() || DEFAULT_API_URL;

  return {
    apiKey,
    apiOrigin: originOf(raw) ?? DEFAULT_API_URL,
    generatePath: normalizePath(
      process.env.NEURAL4D_GENERATE_PATH?.trim() || DEFAULT_GENERATE_PATH,
    ),
    retrievePath: normalizePath(
      process.env.NEURAL4D_RETRIEVE_PATH?.trim() || DEFAULT_RETRIEVE_PATH,
    ),
  };
}

/** Опечатка в переменной окружения не должна ронять приложение целиком. */
function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Заголовки авторизации для вендора.
 *
 * Возвращается объект, а не строка, чтобы ключ не оказался склеен в
 * произвольное сообщение, которое потом кто-нибудь залогирует.
 */
export function neural4dAuthHeaders(config: Neural4DConfig): HeadersInit {
  return { Authorization: `Bearer ${config.apiKey}` };
}

/**
 * Не выключен ли вызов вендора вручную.
 *
 * Раньше здесь был обратный вопрос: вендор молчал, пока кто-нибудь не
 * напишет NEURAL4D_ENABLED=true. Это стоило нам тихой поломки — ключ стоял
 * в окружении, стоил денег, а приложение всё равно отдавало шаблонный дом,
 * и снаружи это выглядело как работающая генерация. Переключатель, о
 * котором надо помнить отдельно от ключа, рано или поздно забывают.
 *
 * Теперь выключателем служит сам ключ: есть NEURAL4D_API_KEY — вендор
 * работает. Эта функция отвечает только на вопрос «не заглушили ли вручную»,
 * и по умолчанию отвечает «нет».
 *
 * Заглушить, оставив ключ на месте (например, чтобы не тратить квоту на
 * стенде), — одна строка:
 *
 *     NEURAL4D_ENABLED=false
 */
export function isNeural4DEnabled(): boolean {
  const raw = process.env.NEURAL4D_ENABLED?.trim().toLowerCase();
  return !(raw === "false" || raw === "0" || raw === "no" || raw === "off");
}
