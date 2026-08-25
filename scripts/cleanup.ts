/**
 * Уборка журнала попыток входа.
 *
 *     npm run db:cleanup
 *
 * Журнал растёт с каждой попыткой входа — и своей, и чужой. Пределу частоты
 * нужны только последние 15 минут, разбору инцидента — последние сутки.
 * Всё, что старше, занимает место и замедляет индексы.
 *
 * Запускать раз в сутки: на Vercel это Cron Job (vercel.json), на своём
 * сервере — обычный cron. Пока этого нет, команду можно звать руками; для
 * первых месяцев работы её отсутствие ничего не сломает.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const { purgeOldLoginAttempts } = await import("../src/lib/server/auth/rate-limit");
  const { getPool } = await import("../src/lib/server/db");

  const pool = getPool();
  try {
    const removed = await purgeOldLoginAttempts(24);
    console.log(`Удалено записей о попытках входа старше суток: ${removed}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
