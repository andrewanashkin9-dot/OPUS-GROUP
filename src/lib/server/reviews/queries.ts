import "server-only";

import { query } from "../db";
import { DomainError } from "../requests/queries";

/**
 * Отзывы клиентов об исполнителях.
 *
 * Средний рейтинг **нигде не хранится** — он считается по таблице при каждом
 * запросе, как и счёт завершённых сделок. Хранимое число пришлось бы
 * пересчитывать при каждом новом отзыве, и рано или поздно оно бы разошлось
 * с реальностью: такие поля всегда врут после первой же забытой ветки кода.
 */

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  /** null — отзыв не привязан к заявке (⚠️ временное послабление, 0010). */
  requestTitle: string | null;
  createdAt: Date;
}

/** Границы оценки. Те же числа проверяет база (миграция 0006). */
export const MIN_RATING = 1;
export const MAX_RATING = 5;

/**
 * Создаёт отзыв.
 *
 * Права проверяются **в базе**, а не здесь: триггер сверяет, что заявка
 * завершена, автор — её клиент, а исполнитель — тот, чей отклик приняли.
 * Уникальность по заявке не даёт написать второй отзыв. Поэтому сюда
 * достаточно передать id заявки: подделать чужую не выйдет, даже если
 * запрос придёт мимо интерфейса.
 *
 * Исполнитель берётся тем же запросом из принятого отклика, а не приходит от
 * клиента: иначе можно было бы поставить единицу постороннему человеку.
 */
export async function createReview(input: {
  requestId: string;
  authorId: string;
  rating: number;
  comment: string | null;
}): Promise<{ id: string }> {
  try {
    const { rows } = await query<{ id: string }>(
      `insert into reviews (request_id, author_id, executor_id, rating, comment)
       select r.id, $2, rs.executor_id, $3, $4
         from requests r
         join responses rs on rs.request_id = r.id and rs.status = 'accepted'
        where r.id = $1
          and r.status = 'completed'
          and r.client_id = $2
       returning id`,
      [input.requestId, input.authorId, input.rating, input.comment],
    );

    if (rows.length === 0) {
      // Пусто означает: заявки нет, она не ваша, не завершена или по ней не
      // приняли ни одного отклика. Наружу уходит один ответ — подсказывать,
      // какая именно из причин, значит рассказывать о чужих заявках.
      throw new DomainError("Отзыв можно оставить только по своей завершённой заявке", 409);
    }
    return rows[0];
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (typeof error === "object" && error !== null && "code" in error) {
      // 23505 — уникальность по заявке: отзыв уже был.
      if (error.code === "23505") {
        throw new DomainError("Вы уже оставили отзыв по этой заявке", 409);
      }
      // 23514 — сработал триггер права или ограничение оценки.
      if (error.code === "23514") {
        throw new DomainError("Отзыв по этой заявке оставить нельзя", 409);
      }
    }
    throw error;
  }
}

/**
 * ⚠️⚠️ ВРЕМЕННОЕ ТЕСТОВОЕ ПОСЛАБЛЕНИЕ — удалить вместе с миграцией 0010. ⚠️⚠️
 *
 * Отзыв об исполнителе от любого вошедшего, без всякой заявки.
 *
 * Существует ровно для того, чтобы форму подачи отзыва можно было потрогать
 * руками, не проходя каждый раз путь заявка → отклик → принятие →
 * завершение. Настоящее правило — `createReview` выше, и вернуть надо будет
 * именно его.
 *
 * Что здесь всё-таки проверяется, потому что это дёшево и осмысленно даже на
 * время проверки:
 *  - адресат существует, он исполнитель и не заблокирован;
 *  - отзыв не самому себе (это ловит `reviews_no_self` в базе);
 *  - один отзыв от человека об исполнителе (`reviews_demo_one_per_pair_idx`).
 */
export async function createReviewForExecutorDEMO(input: {
  executorId: string;
  authorId: string;
  rating: number;
  comment: string | null;
}): Promise<{ id: string }> {
  try {
    const { rows } = await query<{ id: string }>(
      // Адресат сверяется тем же запросом, что и вставка: прочитать его
      // заранее значит оставить окно, в котором его успевают заблокировать.
      `insert into reviews (request_id, author_id, executor_id, rating, comment)
       select null, $2, u.id, $3, $4
         from users u
        where u.id = $1
          and u.role = 'executor'
          and u.status = 'active'
       returning id`,
      [input.executorId, input.authorId, input.rating, input.comment],
    );

    if (rows.length === 0) {
      throw new DomainError("Исполнитель не найден", 404);
    }
    return rows[0];
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "23505") {
        throw new DomainError("Вы уже оставили отзыв об этом исполнителе", 409);
      }
      if (error.code === "23514") {
        throw new DomainError("Нельзя оставить отзыв самому себе", 409);
      }
    }
    throw error;
  }
}

/** Последние отзывы об исполнителе — с текстом, для его карточки. */
export async function listExecutorReviews(executorId: string, limit = 5): Promise<Review[]> {
  const { rows } = await query<Review>(
    `select v.id,
            v.rating,
            v.comment,
            u.display_name as "authorName",
            r.title        as "requestTitle",
            v.created_at   as "createdAt"
       from reviews v
       join users u    on u.id = v.author_id
       -- left join, а не join: с временным послаблением (0010) отзыв может
       -- быть не привязан к заявке, и обычный join выкинул бы такие отзывы
       -- из выдачи молча — рейтинг считался бы по одним строкам, а список
       -- показывал другие.
       left join requests r on r.id = v.request_id
      where v.executor_id = $1
      order by v.created_at desc
      limit $2`,
    [executorId, limit],
  );
  return rows;
}
