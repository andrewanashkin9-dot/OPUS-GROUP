/**
 * Применение миграций.
 *
 *     npm run db:migrate          — применить всё, что ещё не применено
 *     npm run db:migrate:status   — только показать, что применено, а что нет
 *
 * Устройство самое простое из работающих: файлы `migrations/NNNN_name.sql`
 * применяются по возрастанию номера, а применённые записываются в таблицу
 * `schema_migrations` в той же базе. Список применённого живёт рядом с
 * данными, поэтому он не может разойтись с ними при копировании базы.
 *
 * Каждая миграция выполняется в транзакции: либо файл применился целиком,
 * либо база осталась ровно в том состоянии, в каком была. Схема, застрявшая
 * на середине файла, — худший из возможных исходов, чинить её приходится
 * руками на живом сервере.
 *
 * Уже применённый файл сверяется по контрольной сумме. Правка такого файла
 * — самая частая ошибка новичка: у себя всё работает (база-то создавалась
 * заново), а на сервере изменение молча не применяется, потому что версия
 * уже отмечена как выполненная. Здесь это ошибка, а не тишина.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");
const FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/;

interface Migration {
  version: string;
  file: string;
  sql: string;
  checksum: string;
}

async function loadMigrations(): Promise<Migration[]> {
  const entries = (await readdir(MIGRATIONS_DIR)).filter((f) => FILE_PATTERN.test(f)).sort();

  const seen = new Map<string, string>();
  const migrations: Migration[] = [];

  for (const file of entries) {
    const version = FILE_PATTERN.exec(file)![1];
    // Два файла с одним номером применились бы в случайном порядке — на
    // разных машинах по-разному. Лучше отказаться сразу.
    const duplicate = seen.get(version);
    if (duplicate) {
      throw new Error(`Две миграции с номером ${version}: ${duplicate} и ${file}`);
    }
    seen.set(version, file);

    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    migrations.push({
      version,
      file,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex").slice(0, 16),
    });
  }

  return migrations;
}

async function main(): Promise<void> {
  const statusOnly = process.argv.includes("--status");

  // Импорт после loadEnvConfig: модули читают process.env при загрузке.
  const { getDbConfig, describeDbTarget } = await import("../src/lib/server/db-config");
  const { getPool } = await import("../src/lib/server/db");

  console.log(`База: ${describeDbTarget(getDbConfig())}`);

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        version    text        primary key,
        file       text        not null,
        checksum   text        not null,
        applied_at timestamptz not null default now()
      )
    `);

    const applied = new Map<string, { checksum: string; applied_at: Date }>();
    const { rows } = await client.query<{ version: string; checksum: string; applied_at: Date }>(
      "select version, checksum, applied_at from schema_migrations",
    );
    for (const row of rows) applied.set(row.version, row);

    const migrations = await loadMigrations();
    if (migrations.length === 0) {
      console.log("В папке migrations/ нет ни одного файла.");
      return;
    }

    // Сверка раньше применения: если старый файл изменён, останавливаемся до
    // того, как накатили что-то новое поверх расходящейся схемы.
    for (const migration of migrations) {
      const record = applied.get(migration.version);
      if (record && record.checksum !== migration.checksum) {
        throw new Error(
          `Миграция ${migration.file} уже применена, но с тех пор изменена.\n` +
            "  Применённые миграции править нельзя — база о правке не узнает.\n" +
            "  Создайте новый файл со следующим номером.",
        );
      }
    }

    const pending = migrations.filter((m) => !applied.has(m.version));

    if (statusOnly) {
      for (const migration of migrations) {
        const record = applied.get(migration.version);
        console.log(
          record
            ? `  ✅ ${migration.file}  применена ${record.applied_at.toISOString()}`
            : `  ⏳ ${migration.file}  ещё не применена`,
        );
      }
      console.log(`\nВсего ${migrations.length}, ожидают применения: ${pending.length}`);
      return;
    }

    if (pending.length === 0) {
      console.log(`Все ${migrations.length} миграций уже применены — делать нечего.`);
      return;
    }

    for (const migration of pending) {
      process.stdout.write(`  ${migration.file} ... `);
      // BEGIN/COMMIT вокруг каждого файла по отдельности: применённое до
      // сбоя остаётся применённым и отмеченным, повторный запуск продолжит
      // с того же места.
      await client.query("begin");
      try {
        await client.query(migration.sql);
        await client.query(
          "insert into schema_migrations (version, file, checksum) values ($1, $2, $3)",
          [migration.version, migration.file, migration.checksum],
        );
        await client.query("commit");
        console.log("готово");
      } catch (error) {
        await client.query("rollback");
        console.log("ОШИБКА — изменения этого файла отменены");
        throw error;
      }
    }

    console.log(`\n✅ Применено миграций: ${pending.length}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
