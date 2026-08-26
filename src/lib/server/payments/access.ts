import "server-only";

import type { PoolClient } from "pg";
import { query } from "../db";

/**
 * Что можно делать бесплатно, а что по подписке.
 *
 * Правило одно и простое: **первый отклик бесплатный, дальше — подписка.**
 * Смысл в том, чтобы исполнитель мог попробовать площадку по-настоящему, а
 * не смотреть на неё через стекло: один отклик — это одна реальная сделка,
 * после которой уже понятно, стоит ли платить.
 */

/** Сколько откликов можно сделать без подписки. */
export const FREE_RESPONSE_LIMIT = 1;

/**
 * Кусок SQL, проверяющий право на действие.
 *
 * Именно кусок запроса, а не отдельная проверка перед ним: между «проверили,
 * что можно» и «записали отклик» помещается второй такой же запрос, и
 * исполнитель без подписки получил бы два бесплатных отклика вместо одного.
 * Внутри вставки условие проверяется той же командой, что и пишет строку.
 *
 * `$N` — номер параметра с id исполнителя в вызывающем запросе.
 */
export function canRespondSql(executorParam: string): string {
  return `(
    -- Первый отклик бесплатно. Считаются **все** когда-либо созданные, в том
    -- числе отозванные и отклонённые: иначе «отозвать и откликнуться снова»
    -- превратилось бы в бесконечный бесплатный тариф.
    (select count(*) from responses rs_limit
      where rs_limit.executor_id = ${executorParam}) < ${FREE_RESPONSE_LIMIT}
    or exists (
      select 1 from subscriptions s
       where s.executor_id = ${executorParam}
         and s.status in ('active', 'past_due')
         and s.current_period_end > now()
    )
  )`;
}

export interface AccessState {
  usedResponses: number;
  hasActiveSubscription: boolean;
  allowed: boolean;
}

/**
 * Состояние лимита — для сообщения человеку и для интерфейса.
 *
 * Отдельно от проверки в запросе намеренно: та решает «пускать или нет» и
 * обязана быть атомарной, а эта отвечает на вопрос «почему» и может себе
 * позволить быть приблизительной.
 */
export async function readAccessState(
  executorId: string,
  client?: PoolClient,
): Promise<AccessState> {
  const run = client ? client.query.bind(client) : query;
  const { rows } = await run(
    `select (select count(*) from responses rs
              where rs.executor_id = $1)::int as used,
            exists (
              select 1 from subscriptions s
               where s.executor_id = $1
                 and s.status in ('active', 'past_due')
                 and s.current_period_end > now()
            ) as subscribed`,
    [executorId],
  );

  const used = Number((rows[0] as { used: number }).used);
  const subscribed = Boolean((rows[0] as { subscribed: boolean }).subscribed);

  return {
    usedResponses: used,
    hasActiveSubscription: subscribed,
    allowed: subscribed || used < FREE_RESPONSE_LIMIT,
  };
}

/** Текст, который увидит исполнитель, упёршийся в лимит. */
export const LIMIT_MESSAGE =
  "Первый отклик бесплатный, для следующих нужна подписка";
