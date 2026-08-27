import "server-only";

import { query, withTransaction } from "../db";
import { createNotifications } from "../notifications/queries";
import { DomainError } from "../requests/queries";

/**
 * Переписка внутри заявки.
 *
 * Право читать и писать нигде не хранится списком участников — оно каждый
 * раз выводится из состояния заявки: заказчик и исполнитель принятого
 * отклика, пока заявка в работе или завершена. Хранимый список пришлось бы
 * обновлять при каждом принятии, отклонении и отмене, и он разошёлся бы с
 * заявкой на первом же забытом месте.
 *
 * То же правило продублировано триггером в базе (миграция 0011). Это не
 * перестраховка: проверка в коде обходится запросом мимо интерфейса, а
 * переписка о деньгах и сроках — ровно то, что посторонним читать нельзя.
 */

export interface MessageRow {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
  /** Когда собеседник прочитал. null — ещё нет. */
  readAt: Date | null;
}

/** Кто перед нами в этой заявке и что ему можно. */
export interface ThreadAccess {
  canRead: boolean;
  canWrite: boolean;
  /** Собеседник — кому уйдёт уведомление о новом сообщении. */
  partnerId: string | null;
  /** Почему писать нельзя, если нельзя. Для понятного отказа. */
  reason: string | null;
}

/**
 * Право на переписку — одним запросом, без чтения заявки заранее.
 *
 * Читать статус отдельно и решать в коде нельзя: между чтением и записью
 * заявку успевают отменить, и сообщение приедет в закрытую заявку.
 * Поэтому здесь всё считает база, а запись всё равно проверяется триггером.
 */
export async function readThreadAccess(
  requestId: string,
  userId: string,
): Promise<ThreadAccess> {
  const { rows } = await query<{
    isClient: boolean;
    isExecutor: boolean;
    status: string;
    clientId: string;
    executorId: string | null;
  }>(
    `select r.client_id = $2                as "isClient",
            coalesce(rs.executor_id = $2, false) as "isExecutor",
            r.status,
            r.client_id  as "clientId",
            rs.executor_id as "executorId"
       from requests r
       left join responses rs
              on rs.request_id = r.id and rs.status = 'accepted'
      where r.id = $1`,
    [requestId, userId],
  );

  const row = rows[0];
  if (!row || (!row.isClient && !row.isExecutor)) {
    return { canRead: false, canWrite: false, partnerId: null, reason: null };
  }

  // Читать можно всегда, если ты участник: переписка по отменённой заявке
  // остаётся доступной обоим. Стереть историю разговора у человека, с
  // которым не сложилось, — это и есть способ потерять доказательства.
  const canWrite = row.status === "in_progress" || row.status === "completed";
  const partnerId = row.isClient ? row.executorId : row.clientId;

  return {
    canRead: true,
    canWrite,
    partnerId,
    reason: canWrite
      ? null
      : row.status === "cancelled"
        ? "Заявка отменена — переписка доступна только для чтения"
        : "Переписка откроется, когда заявка перейдёт в работу",
  };
}

/** Вся переписка заявки по порядку, старые сверху — как читают разговор. */
export async function listMessages(requestId: string): Promise<MessageRow[]> {
  const { rows } = await query<MessageRow>(
    `select m.id,
            m.author_id    as "authorId",
            u.display_name as "authorName",
            m.body,
            m.created_at   as "createdAt",
            m.read_at      as "readAt"
       from request_messages m
       join users u on u.id = m.author_id
      where m.request_id = $1
      order by m.created_at
      limit 500`,
    [requestId],
  );
  return rows;
}

/**
 * Сколько сообщений собеседника человек ещё не прочитал.
 *
 * Считается по автору, а не по «получателю»: получателя в таблице нет и не
 * должно быть — участники выводятся из заявки, и колонка с получателем
 * разошлась бы с ними на первой же смене исполнителя.
 */
export async function countUnread(requestId: string, userId: string): Promise<number> {
  const { rows } = await query<{ unread: string }>(
    `select count(*) as unread
       from request_messages
      where request_id = $1 and author_id <> $2 and read_at is null`,
    [requestId, userId],
  );
  return Number(rows[0].unread);
}

/**
 * Отмечает прочитанными сообщения собеседника.
 *
 * Свои не трогаем: автор их и так видел, а поставив дату себе, мы сообщили
 * бы собеседнику «прочитано» в тот момент, когда он ещё ничего не открывал.
 *
 * Право проверяется здесь же, `exists`-условием по заявке, а не отдельным
 * чтением: между «убедились, что участник» и «обновили» помещается смена
 * статуса заявки, и посторонний успел бы погасить чужие непрочитанные.
 */
export async function markThreadRead(requestId: string, userId: string): Promise<number> {
  const { rowCount } = await query(
    `update request_messages m
        set read_at = now()
      where m.request_id = $1
        and m.author_id <> $2
        and m.read_at is null
        and exists (
          select 1 from requests r
           where r.id = m.request_id
             and (
               r.client_id = $2
               or exists (
                 select 1 from responses rs
                  where rs.request_id = r.id
                    and rs.status = 'accepted'
                    and rs.executor_id = $2
               )
             )
        )`,
    [requestId, userId],
  );
  return rowCount ?? 0;
}

/**
 * Отправка сообщения.
 *
 * Уведомление собеседнику создаётся **той же транзакцией**, что и само
 * сообщение, — по тому же правилу, что комиссия и отклики: сообщение, о
 * котором не сообщили, для собеседника не существует, а он в это время
 * ждёт ответа.
 */
export async function sendMessage(input: {
  requestId: string;
  authorId: string;
  body: string;
}): Promise<MessageRow> {
  const access = await readThreadAccess(input.requestId, input.authorId);
  // 404 постороннему, а не 403: иначе перебором адресов выясняется, какие
  // заявки существуют и кто в них участвует.
  if (!access.canRead) throw new DomainError("Заявка не найдена", 404);
  if (!access.canWrite) throw new DomainError(access.reason ?? "Писать сюда нельзя", 409);

  try {
    return await withTransaction(async (client) => {
      // Заголовок заявки и имя автора возвращаются той же вставкой: текст
      // уведомления пишется готовым, и добирать их вторым запросом значило
      // бы дать заявке шанс переименоваться между двумя обращениями.
      const { rows } = await client.query<{
        id: string;
        createdAt: Date;
        authorName: string;
        requestTitle: string;
      }>(
        `with inserted as (
           insert into request_messages (request_id, author_id, body)
           values ($1, $2, $3)
           returning id, request_id, author_id, created_at
         )
         select inserted.id,
                inserted.created_at as "createdAt",
                u.display_name      as "authorName",
                r.title             as "requestTitle"
           from inserted
           join users u    on u.id = inserted.author_id
           join requests r on r.id = inserted.request_id`,
        [input.requestId, input.authorId, input.body],
      );
      const created = rows[0];

      if (access.partnerId) {
        await createNotifications(client, [
          {
            userId: access.partnerId,
            kind: "message_received",
            text: `${created.authorName} написал по заявке «${created.requestTitle}»`,
            requestId: input.requestId,
          },
        ]);
      }

      return {
        id: created.id,
        authorId: input.authorId,
        authorName: created.authorName,
        body: input.body,
        createdAt: created.createdAt,
        // Только что отправленное собеседник заведомо ещё не читал.
        readAt: null,
      };
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    // 23514 — сработал триггер участника: между проверкой выше и вставкой
    // заявку успели отменить. Редко, но именно ради этого он там и стоит.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23514") {
      throw new DomainError("Писать в эту заявку сейчас нельзя", 409);
    }
    throw error;
  }
}
