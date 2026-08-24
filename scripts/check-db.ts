/**
 * Проверка подключения к PostgreSQL: один тестовый запрос и понятный ответ.
 *
 *     npm run db:check
 *
 * Скрипт запускается вне Next, поэтому .env он читает сам — тем же загрузчиком,
 * которым это делает `next dev`, чтобы результат проверки совпадал с тем, что
 * увидит приложение.
 *
 * Ни пароль, ни строка подключения целиком наружу не печатаются.
 *
 * Запускается с флагом --conditions=react-server (см. package.json): пакет
 * `server-only` намеренно бросает исключение везде, кроме серверного окружения
 * React, — этот флаг сообщает Node, что мы именно на сервере.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  // Импорт после загрузки .env: модули читают process.env на верхнем уровне.
  const { getDbConfig, describeDbTarget } = await import("../src/lib/server/db-config");
  const { getPool, pingDatabase } = await import("../src/lib/server/db");

  const config = getDbConfig();
  console.log(`Подключаюсь к ${describeDbTarget(config)}`);
  console.log(`TLS: ${config.ssl === false ? "выключен" : config.ssl.ca ? "включён, сертификат проверяется" : "включён, сертификат НЕ проверяется (задайте DB_SSL_ROOT_CERT)"}`);

  const pool = getPool();
  try {
    const info = await pingDatabase();
    console.log("\n✅ Подключение работает.");
    console.log(`   база:    ${info.database}`);
    console.log(`   пользователь: ${info.user}`);
    console.log(`   время на сервере: ${info.serverTime.toISOString()}`);
    console.log(`   версия:  ${info.serverVersion.split(",")[0]}`);
  } finally {
    // Без этого процесс останется висеть: пул держит открытые сокеты.
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n❌ Подключиться не удалось: ${message}`);
  // Частые причины — сразу с подсказкой, что делать.
  if (/ENOTFOUND|EAI_AGAIN/.test(message)) {
    console.error("   Похоже, неверный DB_HOST или нет доступа к DNS.");
  } else if (/ETIMEDOUT|timeout/i.test(message)) {
    console.error("   Хост не отвечает: проверьте DB_PORT и правила группы безопасности в Yandex Cloud.");
  } else if (/password authentication failed|SASL/i.test(message)) {
    console.error("   Неверный DB_USER или DB_PASSWORD.");
  } else if (/self.signed|certificate/i.test(message)) {
    console.error("   Проблема с сертификатом: проверьте DB_SSL_ROOT_CERT.");
  }
  process.exitCode = 1;
});
