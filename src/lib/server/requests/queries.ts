import "server-only";

import { query, withTransaction } from "../db";
import { recordDealCommission } from "../payments/commission";
import { canTransition, transitionError, type RequestStatus } from "./status";

/**
 * Работа с заявками и откликами.
 *
 * Главное правило этого файла: **роль — не право на конкретную строку.**
 * requireRole(["client"]) отвечает на вопрос «клиент ли ты вообще», но не
 * на вопрос «твоя ли это заявка». Без второй проверки любой клиент мог бы
 * завершить или отменить чужую заявку, зная только её id. Поэтому владелец
 * сверяется в самом запросе — условием `where client_id = $2`, а не
 * отдельным чтением с последующим сравнением: между чтением и записью
 * состояние успевает измениться.
 */

export interface RequestRow {
  id: string;
  clientId: string;
  status: RequestStatus;
  title: string;
  description: string | null;
  city: string | null;
  workKinds: string[];
  budgetAmount: string | null;
  currency: string;
  publishedAt: Date | null;
  createdAt: Date;
  responsesCount?: number;
}

/**
 * Список колонок заявки.
 *
 * Префикс параметром, а не заменой подстроки в готовой строке: в SELECT с
 * присоединённой таблицей нужен `r.`, в RETURNING у INSERT — ничего, а
 * «вырезать r. отовсюду» сломается о первый же комментарий, где встретится
 * такое сочетание букв.
 *
 * Приведение work_kinds к text[] обязательно: это массив нашего же типа
 * work_kind, а драйвер умеет разбирать только встроенные типы — для
 * собственных он честно отдаёт сырую строку вида "{roof}". В браузере это
 * уже не массив, и .map() по нему падает.
 */
function requestColumns(prefix: "r." | "" = "r."): string {
  const p = prefix;
  return `
    ${p}id,
    ${p}client_id          as "clientId",
    ${p}status,
    ${p}title,
    ${p}description,
    ${p}city,
    ${p}work_kinds::text[] as "workKinds",
    ${p}budget_amount      as "budgetAmount",
    ${p}currency,
    ${p}published_at       as "publishedAt",
    ${p}created_at         as "createdAt"
  `;
}

export async function createRequest(input: {
  clientId: string;
  title: string;
  description: string | null;
  city: string | null;
  workKinds: string[];
  budgetAmount: string | null;
}): Promise<RequestRow> {
  const { rows } = await query<RequestRow>(
    `insert into requests
       (client_id, status, title, description, city, work_kinds, budget_amount, published_at)
     values ($1, 'published', $2, $3, $4, $5::work_kind[], $6, now())
     returning ${requestColumns("")}`,
    [input.clientId, input.title, input.description, input.city, input.workKinds, input.budgetAmount],
  );
  return rows[0];
}

/** Свои заявки клиента, свежие сверху, с числом откликов. */
export async function listClientRequests(clientId: string): Promise<RequestRow[]> {
  const { rows } = await query<RequestRow>(
    `select ${requestColumns()},
            (select count(*) from responses rs
              where rs.request_id = r.id and rs.status <> 'withdrawn')::int as "responsesCount"
       from requests r
      where r.client_id = $1
      order by r.created_at desc
      limit 100`,
    [clientId],
  );
  return rows;
}

/**
 * Лента для исполнителя: только новые заявки.
 *
 * Свои заявки исполнитель здесь не увидит (он мог зарегистрироваться и как
 * клиент — роли на одном человеке не исключают друг друга по данным),
 * и заявки, на которые уже откликнулся, — тоже: повторный отклик всё равно
 * не примет база.
 */
export async function listOpenRequests(executorId: string): Promise<RequestRow[]> {
  const { rows } = await query<RequestRow>(
    `select ${requestColumns()}
       from requests r
      where r.status = 'published'
        and r.client_id <> $1
        and not exists (
          select 1 from responses rs
           where rs.request_id = r.id and rs.executor_id = $1 and rs.status <> 'withdrawn'
        )
      order by r.published_at desc
      limit 100`,
    [executorId],
  );
  return rows;
}

export async function findRequest(id: string): Promise<RequestRow | null> {
  const { rows } = await query<RequestRow>(
    `select ${requestColumns()} from requests r where r.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export interface ResponseRow {
  id: string;
  requestId: string;
  executorId: string;
  executorName: string;
  executorCity: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  message: string | null;
  priceAmount: string | null;
  leadTimeDays: number | null;
  createdAt: Date;
}

export async function listResponses(requestId: string): Promise<ResponseRow[]> {
  const { rows } = await query<ResponseRow>(
    `select rs.id,
            rs.request_id  as "requestId",
            rs.executor_id as "executorId",
            u.display_name as "executorName",
            u.city         as "executorCity",
            rs.status,
            rs.message,
            rs.price_amount   as "priceAmount",
            rs.lead_time_days as "leadTimeDays",
            rs.created_at     as "createdAt"
       from responses rs
       join users u on u.id = rs.executor_id
      where rs.request_id = $1
      order by rs.created_at`,
    [requestId],
  );
  return rows;
}

export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Отклик исполнителя.
 *
 * Статус заявки проверяется тем же запросом, который вставляет отклик, —
 * через `select ... where status = 'published'` в источнике вставки. Прочитай
 * мы статус заранее отдельным запросом, между чтением и вставкой клиент
 * успел бы отменить заявку, и отклик приехал бы на отменённую.
 */
export async function createResponse(input: {
  requestId: string;
  executorId: string;
  message: string | null;
  priceAmount: string | null;
  leadTimeDays: number | null;
}): Promise<ResponseRow> {
  try {
    const { rows } = await query<{ id: string }>(
      `insert into responses (request_id, executor_id, message, price_amount, lead_time_days)
       select r.id, $2, $3, $4, $5
         from requests r
        where r.id = $1 and r.status = 'published'
       returning id`,
      [input.requestId, input.executorId, input.message, input.priceAmount, input.leadTimeDays],
    );

    if (rows.length === 0) {
      // Ноль строк означает, что источник вставки пуст: заявки нет или она
      // уже не «новая». Снаружи это одно и то же — подсказывать, что заявка
      // существует, но занята, незачем.
      throw new DomainError("Заявка не найдена или больше не принимает отклики", 409);
    }

    const responses = await listResponses(input.requestId);
    return responses.find((r) => r.id === rows[0].id)!;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    // 23505 — уникальность: этот исполнитель уже откликался.
    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "23505") throw new DomainError("Вы уже откликнулись на эту заявку", 409);
      // 23514 — сработал триггер «нельзя откликнуться на свою заявку».
      if (error.code === "23514") throw new DomainError("Нельзя откликнуться на собственную заявку", 409);
    }
    throw error;
  }
}

/**
 * Клиент принимает отклик: заявка уходит в работу, остальные отклики
 * отклоняются.
 *
 * Три изменения — одной транзакцией. Иначе оборванная связь оставила бы
 * принятый отклик при «новой» заявке или двух принятых исполнителей.
 */
export async function acceptResponse(responseId: string, clientId: string): Promise<void> {
  await withTransaction(async (client) => {
    // `for update` держит строку заявки до конца транзакции. Без него два
    // одновременных подтверждения двух разных откликов оба прочитали бы
    // «новая» и оба прошли бы проверку.
    const { rows } = await client.query<{ requestId: string; status: RequestStatus }>(
      `select r.id as "requestId", r.status
         from responses rs
         join requests r on r.id = rs.request_id
        where rs.id = $1 and r.client_id = $2 and rs.status = 'pending'
        for update of r`,
      [responseId, clientId],
    );

    const found = rows[0];
    if (!found) throw new DomainError("Отклик не найден", 404);
    if (!canTransition(found.status, "in_progress")) {
      throw new DomainError(transitionError(found.status, "in_progress"), 409);
    }

    await client.query(`update responses set status = 'accepted' where id = $1`, [responseId]);
    await client.query(
      `update responses set status = 'rejected'
        where request_id = $1 and id <> $2 and status = 'pending'`,
      [found.requestId, responseId],
    );
    await client.query(`update requests set status = 'in_progress' where id = $1`, [
      found.requestId,
    ]);
  });
}

/**
 * Смена статуса заявки её владельцем: завершение и отмена.
 *
 * Владелец, текущий статус и допустимость перехода проверяются одним
 * запросом. Если ничего не обновилось — читаем причину и объясняем её.
 */
export async function changeRequestStatus(
  requestId: string,
  clientId: string,
  to: Extract<RequestStatus, "completed" | "cancelled">,
): Promise<void> {
  const allowedFrom = (["draft", "published", "in_progress"] as const).filter((from) =>
    canTransition(from, to),
  );

  await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `update requests set status = $3
        where id = $1 and client_id = $2 and status = any($4::request_status[])`,
      [requestId, clientId, to, allowedFrom],
    );

    if (rowCount === 0) {
      const current = await findRequest(requestId);
      // «Не твоя заявка» и «нет такой заявки» — один ответ. Иначе перебором id
      // выясняется, какие заявки существуют.
      if (!current || current.clientId !== clientId) {
        throw new DomainError("Заявка не найдена", 404);
      }
      throw new DomainError(transitionError(current.status, to), 409);
    }

    // Завершение сделки — момент, когда возникает вознаграждение. Комиссия
    // пишется той же транзакцией: завершённая заявка без строки в учёте
    // означает недостачу, которую обнаружат при сверке в конце квартала,
    // когда восстанавливать сумму уже неоткуда.
    if (to === "completed") {
      await recordDealCommission(client, requestId);
    }
  });
}
