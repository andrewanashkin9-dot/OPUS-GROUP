/**
 * TODO: удалить перед запуском — демо-вставка, удаляется вместе с остальными
 * (см. TODO_BEFORE_LAUNCH.md).
 *
 * Демо-данные при деплое.
 *
 *     npm run db:seed:deploy
 *
 * Вызывается из `vercel-build` после миграций. Правила те же, что у
 * `deploy-migrate.ts`: только боевой деплой, только при настроенной базе,
 * молча пропустить — нормальный исход.
 *
 * Отличие ровно одно, и оно принципиальное: **упавший сид сборку не валит.**
 * Миграции — это схема, без них новый код ломается у живых людей. Демо-люди
 * — витрина: не завелись, значит на сайте пусто, а сайт работает. Уронить из
 * за них деплой было бы обменом настоящей поломки на ненастоящую.
 *
 * «Ровно один раз» держит отметка в таблице `demo_seed_state`, а не наличие
 * самих данных. Разница вскроется в тот день, когда демо-данные уберут перед
 * запуском: по данным деплой завёл бы их обратно, по отметке — нет.
 */
import { spawn } from "node:child_process";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const vercelEnv = process.env.VERCEL_ENV;

/**
 * Выключатель на случай, если демо-данные не нужны вовсе. Ставится в панели
 * Vercel — например, когда до запуска остаётся неделя и заводить выдуманных
 * людей на боевом сайте уже незачем.
 */
const skipRequested = ["1", "true", "yes"].includes(
  (process.env.SKIP_DEPLOY_SEED ?? "").toLowerCase(),
);

async function main(): Promise<void> {
  if (skipRequested) {
    console.log("SKIP_DEPLOY_SEED — демо-данные пропущены по требованию.");
    return;
  }

  const { isDbConfigured } = await import("../src/lib/server/db-config");
  if (!isDbConfigured()) {
    console.log("Переменные PostgreSQL не заданы — демо-данные пропущены.");
    return;
  }

  if (vercelEnv && vercelEnv !== "production") {
    console.log(`Деплой окружения «${vercelEnv}», а не production — демо-данные пропущены.`);
    return;
  }

  await run("npx", [
    "tsx",
    "--conditions=react-server",
    "scripts/seed-demo.ts",
    "--if-absent",
  ]);
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} завершился с кодом ${code}`));
    });
  });
}

main().catch((error: unknown) => {
  // Предупреждение, а не падение. Сборка продолжается: сайт без демо-данных
  // работает, а деплой, остановленный из-за выдуманных людей, не работает
  // вовсе.
  console.warn(
    `\n⚠️ Демо-данные не завелись: ${error instanceof Error ? error.message : String(error)}`,
  );
  console.warn("Сборка продолжается — сайт от этого не ломается, просто витрина будет пустой.");
});
