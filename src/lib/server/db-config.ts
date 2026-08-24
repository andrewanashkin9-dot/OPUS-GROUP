// Сборка падает, если этот модуль импортируют из клиентского компонента.
// Пароль от базы физически не может уехать в браузерный бандл.
import "server-only";

import { readFileSync } from "node:fs";

/**
 * Чтение настроек PostgreSQL из окружения. Единственное место в проекте,
 * которое знает имена переменных и знает пароль.
 *
 * Правила те же, что и для ключа вендора:
 *  - значения читаются только из process.env на сервере;
 *  - ни у одной переменной нет префикса NEXT_PUBLIC_, поэтому Next никогда
 *    не подставит их в клиентский бандл;
 *  - пароль не логируется и не попадает в текст ошибки — наружу уходит
 *    только факт «настроено / не настроено» и имя недостающей переменной.
 */

/** Порт по умолчанию — пулер Odyssey в Yandex Cloud (не 5432 самой БД). */
const DEFAULT_PORT = 6432;

/** Переменные, без которых подключаться некуда. */
const REQUIRED = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"] as const;

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  /** false — TLS выключен; объект — включён, с CA-сертификатом или без. */
  ssl: false | { ca?: string; rejectUnauthorized: boolean };
}

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/**
 * Приводит DB_HOST к чистому имени хоста.
 *
 * В консоли Yandex Cloud имя хоста удобно скопировать вместе с `https://` и
 * завершающим слэшем, а `postgres` ждёт голый FQDN и на `https://host/`
 * отвечает невнятным ENOTFOUND. Дешевле молча срезать лишнее, чем каждый раз
 * разбираться, почему «хост правильный, а не подключается».
 *
 * Порт из строки вида `host:6432` тоже срезается: за порт отвечает DB_PORT,
 * и два источника одного значения рано или поздно разойдутся.
 */
export function normalizeHost(raw: string): string {
  return raw
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "") // схема: https://, postgres:// ...
    .replace(/\/.*$/, "") // путь и завершающий слэш
    .replace(/:\d+$/, "") // порт — он задаётся через DB_PORT
    .trim();
}

/**
 * Собирает настройки TLS.
 *
 * Managed PostgreSQL в Yandex Cloud принимает только шифрованные соединения,
 * поэтому по умолчанию TLS включён. Сертификат облака (DB_SSL_ROOT_CERT)
 * задавать не обязательно, но пока он не задан, клиент не может доказать,
 * что говорит именно с нашей базой, — поэтому без него мы предупреждаем.
 */
function readSsl(): DbConfig["ssl"] {
  const mode = env("DB_SSL").toLowerCase() || "require";
  if (mode === "disable" || mode === "false" || mode === "off") return false;

  const caPath = env("DB_SSL_ROOT_CERT");
  if (!caPath) {
    // Соединение шифруется, но подлинность сервера не проверяется.
    // Годится для локальных экспериментов, не годится для продакшена.
    return { rejectUnauthorized: false };
  }

  // Путь к файлу берётся из окружения, а не из запроса: иначе кто угодно
  // мог бы заставить сервер прочитать произвольный файл с диска.
  return { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true };
}

/**
 * Возвращает настройки подключения.
 *
 * Бросает исключение с перечнем недостающих переменных — но никогда не
 * показывает их значения. Пустой .env ломает только работу с базой,
 * остальное приложение продолжает работать.
 */
export function getDbConfig(): DbConfig {
  const missing = REQUIRED.filter((name) => !env(name));
  if (missing.length > 0) {
    throw new Error(
      `Не заданы переменные окружения для PostgreSQL: ${missing.join(", ")}. ` +
        "Скопируйте .env.example в .env и заполните значения.",
    );
  }

  const rawPort = env("DB_PORT");
  const port = rawPort ? Number(rawPort) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`DB_PORT должен быть числом от 1 до 65535, получено: ${rawPort}`);
  }

  return {
    host: normalizeHost(env("DB_HOST")),
    port,
    database: env("DB_NAME"),
    user: env("DB_USER"),
    password: env("DB_PASSWORD"),
    ssl: readSsl(),
  };
}

/**
 * Описание подключения для логов и сообщений об ошибках — без пароля.
 * Отдельная функция нужна, чтобы конфиг целиком случайно не ушёл в console.log.
 */
export function describeDbTarget(config: DbConfig): string {
  return `${config.user}@${config.host}:${config.port}/${config.database}`;
}
