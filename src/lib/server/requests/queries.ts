import "server-only";

import type { PoolClient } from "pg";

import { query, withTransaction } from "../db";
import { createNotifications } from "../notifications/queries";
import { recordDealCommission } from "../payments/commission";
import { LIMIT_MESSAGE, canRespondSql, readAccessState } from "../payments/access";
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
  /** Оставлен ли отзыв по этой заявке — чтобы не показывать форму дважды. */
  hasReview?: boolean;
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
              where rs.request_id = r.id and rs.status <> 'withdrawn')::int as "responsesCount",
            exists (select 1 from reviews v where v.request_id = r.id) as "hasReview"
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
  return listResponsesIn(null, requestId);
}

/**
 * То же самое, но внутри уже открытой транзакции.
 *
 * Обычный `query` берёт из пула **другое** соединение, а значит не видит
 * незакоммиченную вставку: только что созданный отклик из него просто не
 * читается. Поэтому чтение после записи идёт тем же клиентом.
 */
async function listResponsesIn(
  client: PoolClient | null,
  requestId: string,
): Promise<ResponseRow[]> {
  const run = client ? client.query.bind(client) : query;
  const { rows } = await run<ResponseRow>(
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
    return await withTransaction(async (client) => {
      const { rows } = await client.query<{
        id: string;
        clientId: string;
        title: string;
        executorName: string;
      }>(
        // Право на отклик проверяется внутри самой вставки, а не запросом
        // перед ней: между «проверили» и «записали» помещается второй такой же
        // запрос, и исполнитель без подписки получил бы два бесплатных отклика.
        //
        // Владелец заявки и её название возвращаются той же вставкой — чтобы
        // текст уведомления не пришлось добирать вторым запросом, за время
        // которого заявку успевают переименовать.
        `with inserted as (
           insert into responses (request_id, executor_id, message, price_amount, lead_time_days)
           select r.id, $2, $3, $4, $5
             from requests r
            where r.id = $1
              and r.status = 'published'
              and ${canRespondSql("$2")}
           returning id, request_id
         )
         select inserted.id,
                r.client_id    as "clientId",
                r.title,
                u.display_name as "executorName"
           from inserted
           join requests r on r.id = inserted.request_id
           join users u on u.id = $2`,
        [input.requestId, input.executorId, input.message, input.priceAmount, input.leadTimeDays],
      );

      if (rows.length === 0) {
        // Ноль строк — либо заявка не принимает отклики, либо кончился лимит.
        // Это разные вещи для человека: во втором случае ему нужна ссылка на
        // оплату, а не «попробуйте другую заявку». Разбираем, что именно.
        const access = await readAccessState(input.executorId);
        if (!access.allowed) {
          // 402 Payment Required — ровно этот случай: запрос корректен,
          // не хватает оплаты. Клиент по коду понимает, что показать.
          throw new DomainError(LIMIT_MESSAGE, 402);
        }
        throw new DomainError("Заявка не найдена или больше не принимает отклики", 409);
      }

      const created = rows[0];

      // Уведомление — той же транзакцией, что и отклик. Отклик, о котором
      // клиенту не сообщили, для клиента не существует: он видит «никто не
      // откликнулся» и уходит к другим.
      await createNotifications(client, [
        {
          userId: created.clientId,
          kind: "response_received",
          text: `Новый отклик на заявку «${created.title}» — ${created.executorName}`,
          requestId: input.requestId,
          responseId: created.id,
        },
      ]);

      const responses = await listResponsesIn(client, input.requestId);
      return responses.find((r) => r.id === created.id)!;
    });
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
    const { rows } = await client.query<{
      requestId: string;
      status: RequestStatus;
      title: string;
      executorId: string;
    }>(
      `select r.id as "requestId", r.status, r.title, rs.executor_id as "executorId"
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
    // returning — чтобы узнать, кого именно отклонили, не читая таблицу
    // повторно: после этого же UPDATE строк со статусом 'pending' уже нет.
    const { rows: rejected } = await client.query<{ id: string; executorId: string }>(
      `update responses set status = 'rejected'
        where request_id = $1 and id <> $2 and status = 'pending'
        returning id, executor_id as "executorId"`,
      [found.requestId, responseId],
    );
    await client.query(`update requests set status = 'in_progress' where id = $1`, [
      found.requestId,
    ]);

    // Уведомления — той же транзакцией. Отказ приходит сразу, а не молчанием:
    // исполнитель, которому не сообщили, продолжает держать сроки под заявку,
    // которую уже отдали другому.
    await createNotifications(client, [
      {
        userId: found.executorId,
        kind: "response_accepted",
        text: `Ваш отклик на заявку «${found.title}» принят — можно приступать`,
        requestId: found.requestId,
        responseId,
      },
      ...rejected.map((r) => ({
        userId: r.executorId,
        kind: "response_rejected" as const,
        text: `По заявке «${found.title}» выбрали другого исполнителя`,
        requestId: found.requestId,
        responseId: r.id,
      })),
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
    const { rowCount, rows } = await client.query<{ title: string }>(
      `update requests set status = $3
        where id = $1 and client_id = $2 and status = any($4::request_status[])
        returning title`,
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

    // Кого касается смена статуса, кроме самого клиента.
    //
    // При завершении это исполнитель, чей отклик приняли. При отмене —
    // ещё и те, кто откликнулся и ждёт ответа: иначе они держат сроки под
    // заявку, которой больше нет.
    const { rows: affected } = await client.query<{ executorId: string }>(
      `select distinct executor_id as "executorId"
         from responses
        where request_id = $1
          and status = any($2::response_status[])`,
      [requestId, to === "completed" ? ["accepted"] : ["accepted", "pending"]],
    );

    const title = rows[0].title;
    await createNotifications(
      client,
      affected.map((a) => ({
        userId: a.executorId,
        kind: to === "completed" ? ("request_completed" as const) : ("request_cancelled" as const),
        text:
          to === "completed"
            ? `Клиент принял работу по заявке «${title}»`
            : `Заявка «${title}» отменена клиентом`,
        requestId,
      })),
    );
    // Самому клиенту уведомления нет: он и есть тот, кто сейчас нажал кнопку,
    // и сообщать человеку о его собственном действии — шум, который приучает
    // не открывать колокольчик вовсе.
  });
}
