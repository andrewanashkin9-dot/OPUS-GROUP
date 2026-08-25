import "server-only";

import { Pool } from "pg";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { getDbConfig } from "./db-config";

/**
 * Пул соединений с PostgreSQL.
 *
 * Пул, а не отдельное соединение на запрос: установка TLS-сессии стоит
 * заметно дороже самого запроса, а Managed PostgreSQL ограничивает число
 * соединений. Пул держит несколько открытых и раздаёт их по очереди.
 *
 * Пул создаётся лениво — при первом запросе. Пока к базе никто не обратился,
 * приложение поднимается даже с пустым .env.
 */

// В dev-режиме Next перезагружает модули при каждом изменении файла. Без этой
// ссылки на globalThis каждая перезагрузка создавала бы новый пул, а старый
// продолжал бы держать соединения — за час разработки лимит БД был бы выбран.
const globalForDb = globalThis as typeof globalThis & { __opusDbPool?: Pool };

export function getPool(): Pool {
  if (globalForDb.__opusDbPool) return globalForDb.__opusDbPool;

  const config = getDbConfig();
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    // Сколько соединений держать открытыми. Больше — не быстрее: упрёмся
    // в лимит пулера, и лишние запросы будут ждать уже на его стороне.
    max: 10,
    // Простаивающее соединение закрывается, чтобы не занимать слот в пулере.
    idleTimeoutMillis: 30_000,
    // Не ждать вечно, если база недоступна: лучше быстрая понятная ошибка,
    // чем зависший на минуту запрос пользователя.
    connectionTimeoutMillis: 10_000,
  });

  // Соединение может умереть, пока лежит в пуле (перезапуск базы, разрыв
  // сети). Без этого обработчика такая ошибка роняет весь процесс Node.
  pool.on("error", (error) => {
    console.error("[db] соединение в пуле оборвалось:", error.message);
  });

  globalForDb.__opusDbPool = pool;
  return pool;
}

/**
 * Выполняет запрос.
 *
 * Параметры передаются отдельным массивом ($1, $2, ...), а не склейкой строк —
 * так значения не могут превратиться в SQL-код (SQL-инъекция).
 *
 *     await query("select * from orders where id = $1", [orderId]);
 */
export function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[],
): Promise<QueryResult<Row>> {
  return getPool().query<Row>(text, params as unknown[] | undefined);
}

/**
 * Выполняет несколько запросов как одно целое.
 *
 * Нужно там, где половина работы хуже, чем никакой. Подтверждение отклика —
 * ровно такой случай: надо пометить один отклик принятым, остальные
 * отклонёнными и перевести заявку в работу. Оборвись связь посередине —
 * заявка осталась бы «новой» с уже принятым откликом, и никакой экран не
 * показал бы правды.
 *
 * Все запросы внутри идут по одному и тому же соединению: транзакция живёт
 * в соединении, и запрос, ушедший в соседнее из пула, окажется вне её.
 * Поэтому внутрь передаётся клиент, а не общая функция query.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    // Откат в своём try: если и он не удался (соединение уже мертво),
    // наружу должна уйти исходная ошибка, а не ошибка отката, которая
    // скроет настоящую причину.
    try {
      await client.query("rollback");
    } catch {
      /* соединение потеряно — база откатит транзакцию сама */
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Проверка связи: один дешёвый запрос к базе.
 *
 * Возвращает то, что база сама о себе сообщает, — этого достаточно, чтобы
 * убедиться, что адрес, порт, пароль и TLS настроены верно.
 */
export interface DbPingResult {
  serverVersion: string;
  database: string;
  user: string;
  serverTime: Date;
}

export async function pingDatabase(): Promise<DbPingResult> {
  const result = await query<{
    server_version: string;
    database: string;
    username: string;
    server_time: Date;
  }>(
    `select version()      as server_version,
            current_database() as database,
            current_user       as username,
            now()              as server_time`,
  );

  const row = result.rows[0];
  return {
    serverVersion: row.server_version,
    database: row.database,
    user: row.username,
    serverTime: row.server_time,
  };
}
