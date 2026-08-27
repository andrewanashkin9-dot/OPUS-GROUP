/**
 * Уборка журналов.
 *
 *     npm run db:cleanup
 *
 * Убирает три журнала: попытки входа, погашенные одноразовые ссылки и
 * записи об обращениях к персональным данным. У каждого свой срок — он
 * определяется тем, зачем журнал нужен, а не тем, сколько влезет на диск.
 *
 * Запускать раз в сутки: на Vercel это Cron Job (vercel.json), на своём
 * сервере — обычный cron. Пока этого нет, команду можно звать руками; для
 * первых месяцев работы её отсутствие ничего не сломает.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const { purgeOldLoginAttempts } = await import("../src/lib/server/auth/rate-limit");
  const { purgeUsedTokens } = await import("../src/lib/server/auth/email-tokens");
  const { purgeOldAccessLog } = await import("../src/lib/server/audit/personal-data");
  const { getPool } = await import("../src/lib/server/db");

  const pool = getPool();
  try {
    console.log(`Попытки входа старше суток:            ${await purgeOldLoginAttempts(24)}`);
    console.log(`Погашенные ссылки старше 30 дней:      ${await purgeUsedTokens(30)}`);
    // Год — срок хранения журнала обращений к персональным данным. Держать
    // дольше нельзя: 152-ФЗ требует не хранить данные дольше, чем нужно для
    // цели, а цель журнала — разбор инцидентов, а не летопись.
    console.log(`Записи журнала 152-ФЗ старше года:     ${await purgeOldAccessLog(365)}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
