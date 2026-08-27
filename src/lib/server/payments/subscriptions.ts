import "server-only";

import { query, withTransaction } from "../db";
import { createNotifications } from "../notifications/queries";
import { getTKassaConfig, isBillingEnabled } from "./config";
import { initPayment, rublesToKopecks } from "./tkassa";

/**
 * Подписка исполнителя: начало оплаты и её завершение по уведомлению банка.
 *
 * Порядок событий важен и он не тот, которого ждёшь: **сначала заводится
 * платёж, и только потом — оплаченный период.** Пока деньги не дошли,
 * открывать доступ не за что, поэтому строка подписки появляется в момент
 * подтверждения, а не в момент нажатия кнопки.
 */

/** Сколько длится оплаченный период. */
const PERIOD_DAYS = 30;

export class BillingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface CheckoutResult {
  paymentUrl: string;
  transactionId: string;
}

/**
 * Начало оплаты подписки.
 *
 * Строка платежа создаётся **до** обращения к банку и её id уходит туда как
 * OrderId. Так у нас есть запись о попытке даже если банк не ответит, а
 * вернувшееся уведомление всегда находит, к чему относится.
 */
export async function startSubscriptionCheckout(executorId: string): Promise<CheckoutResult> {
  if (!isBillingEnabled()) {
    throw new BillingError("Оплата пока не подключена", 503);
  }
  const config = getTKassaConfig();
  if (!config) {
    throw new BillingError("Оплата пока не подключена", 503);
  }

  const price = config.subscriptionPrice;

  // Комиссия за подписку не удерживается: это наша выручка целиком, поэтому
  // ставка нулевая, а net равен gross. Проверка в базе (net = gross -
  // commission) сойдётся.
  const { rows } = await query<{ id: string }>(
    `insert into transactions (kind, status, user_id, gross_amount, net_amount)
     values ('subscription_fee', 'pending', $1, $2, $2)
     returning id`,
    [executorId, price],
  );
  const transactionId = rows[0].id;

  try {
    const payment = await initPayment(config, {
      orderId: transactionId,
      amountKopecks: rublesToKopecks(price),
      description: "Подписка Technic, 30 дней",
      // CustomerKey — наш id пользователя. По нему банк привязывает
      // сохранённую карту к человеку, а не к разовому платежу.
      customerKey: executorId,
      recurrent: true,
    });

    await query(`update transactions set external_id = $2 where id = $1`, [
      transactionId,
      payment.PaymentId,
    ]);

    if (!payment.PaymentURL) {
      throw new BillingError("Банк не вернул ссылку на оплату", 502);
    }

    return { paymentUrl: payment.PaymentURL, transactionId };
  } catch (error) {
    // Платёж не состоялся — помечаем, а не удаляем. Удалённая строка не
    // расскажет, что попытка была и чем кончилась.
    await query(`update transactions set status = 'failed' where id = $1`, [transactionId]);
    throw error;
  }
}

/**
 * Уведомление «платёж прошёл».
 *
 * Здесь всё держится на одном свойстве: **повторное уведомление о том же
 * платеже не должно продлить подписку второй раз.** Банк повторяет
 * уведомления при любой заминке в ответе, и без защиты человек получил бы
 * шестьдесят дней за одну оплату. Поэтому переход в 'succeeded' — условный:
 * обновляется только строка, которая всё ещё 'pending'.
 */
export async function confirmSubscriptionPayment(input: {
  orderId: string;
  paymentId: string;
  rebillId: string | null;
}): Promise<"applied" | "already_applied" | "unknown_order"> {
  return withTransaction(async (client) => {
    // Порядок здесь не произвольный, и первая версия была написана неверно.
    // Правило в базе гласит: у **состоявшегося** платежа подписка обязана
    // быть. Значит пометить платёж успешным раньше, чем появилась подписка,
    // нельзя — проверка сработает на этом же запросе, не дожидаясь конца
    // транзакции. Поэтому: сначала занимаем платёж, потом открываем период,
    // и лишь затем одним запросом ставим статус вместе со ссылкой.
    //
    // `for update` держит строку до конца транзакции. Банк повторяет
    // уведомления, и два повтора могут прийти одновременно: без блокировки
    // оба увидели бы 'pending' и оба продлили бы подписку — шестьдесят дней
    // за одну оплату.
    const { rows } = await client.query<{
      id: string;
      user_id: string;
      gross_amount: string;
      status: string;
    }>(
      `select id, user_id, gross_amount, status
         from transactions
        where id = $1 and kind = 'subscription_fee'
        for update`,
      [input.orderId],
    );

    const payment = rows[0];
    if (!payment) return "unknown_order";
    // Уже обработан — молча подтверждаем банку, чтобы он перестал повторять.
    if (payment.status !== "pending") return "already_applied";

    // Тот же PaymentId, но на другом заказе. Значит уведомление о платеже,
    // который мы уже провели, просто пришло с чужим OrderId. Занимать им
    // второй заказ нельзя — это открыло бы второй оплаченный период за одни
    // деньги. Уникальность external_id всё равно не даст записать дважды, но
    // тогда это была бы ошибка 500 и вечные повторы: банк повторяет, пока не
    // получит OK, а исправиться тут нечему.
    if (input.paymentId) {
      const { rows: clash } = await client.query(
        `select 1 from transactions where external_id = $1 and id <> $2`,
        [input.paymentId, input.orderId],
      );
      if (clash.length > 0) return "already_applied";
    }

    // Оплаченный период: продлеваем от текущего конца, если подписка ещё
    // действует, и от «сейчас», если она уже истекла. Иначе оплата за день
    // до конца периода съедала бы почти месяц.
    const { rows: created } = await client.query<{ id: string }>(
      `insert into subscriptions
         (executor_id, plan, status, current_period_start, current_period_end,
          price_amount, rebill_id)
       values ($1, 'pro', 'active', now(),
               now() + make_interval(days => $3), $2, $4)
       on conflict do nothing
       returning id`,
      [payment.user_id, payment.gross_amount, PERIOD_DAYS, input.rebillId],
    );

    let subscriptionId = created[0]?.id;

    if (!subscriptionId) {
      // Действующая подписка уже есть — значит это продление.
      const { rows: updated } = await client.query<{ id: string }>(
        `update subscriptions
            set status               = 'active',
                plan                 = 'pro',
                current_period_start = now(),
                current_period_end   = greatest(current_period_end, now())
                                       + make_interval(days => $2),
                price_amount         = $3,
                rebill_id            = coalesce($4, rebill_id),
                cancel_at_period_end = false
          -- Только действующая строка: у исполнителя могут лежать и старые,
          -- истёкшие подписки, а продлить надо текущую.
          where executor_id = $1 and status in ('active', 'past_due')
          returning id`,
        [payment.user_id, PERIOD_DAYS, payment.gross_amount, input.rebillId],
      );
      subscriptionId = updated[0]?.id;
    }

    if (!subscriptionId) {
      // Такого быть не должно: либо вставили, либо продлили. Но если вдруг —
      // лучше отказаться и дать банку повторить, чем записать успешный
      // платёж, не привязанный ни к какому оплаченному периоду.
      throw new Error(`Не удалось открыть период подписки по платежу ${input.orderId}`);
    }

    // Статус и ссылка — одним запросом: правило в базе проверяет строку
    // целиком, и разнести их на два шага нельзя.
    await client.query(
      `update transactions
          set status          = 'succeeded',
              subscription_id = $2,
              external_id     = coalesce(external_id, $3),
              occurred_at     = now()
        where id = $1`,
      [payment.id, subscriptionId, input.paymentId],
    );

    return "applied";
  });
}

/** Уведомление «платёж не прошёл». */
export async function failSubscriptionPayment(orderId: string): Promise<void> {
  await query(
    `update transactions set status = 'failed'
      where id = $1 and kind = 'subscription_fee' and status = 'pending'`,
    [orderId],
  );
}

/**
 * Подписки, которым пора списать следующий месяц.
 *
 * Берутся только те, у кого есть сохранённая карта и кто не отменил
 * продление. Отменившим период просто истекает.
 */
export interface DueSubscription {
  id: string;
  executorId: string;
  rebillId: string;
  priceAmount: string;
}

export async function listDueSubscriptions(): Promise<DueSubscription[]> {
  const { rows } = await query<DueSubscription>(
    `select id,
            executor_id  as "executorId",
            rebill_id    as "rebillId",
            price_amount as "priceAmount"
       from subscriptions
      where status in ('active', 'past_due')
        and cancel_at_period_end = false
        and rebill_id is not null
        and current_period_end <= now()
      order by current_period_end
      limit 500`,
  );
  return rows;
}

/** Подписка, по которой списание не удалось: доступ пока оставляем. */
export async function markPastDue(subscriptionId: string): Promise<void> {
  await query(`update subscriptions set status = 'past_due' where id = $1`, [subscriptionId]);
}

/** Периоды, которые давно истекли и не оплачены. */
export async function expireStaleSubscriptions(graceDays = 3): Promise<number> {
  return withTransaction(async (client) => {
    const { rowCount, rows } = await client.query<{ executorId: string }>(
      `update subscriptions set status = 'expired'
        where status = 'past_due'
          and current_period_end < now() - make_interval(days => $1)
        returning executor_id as "executorId"`,
      [graceDays],
    );

    // Уведомление — той же транзакцией, что и снятие доступа. Иначе
    // исполнитель обнаруживает потерю подписки в тот момент, когда пытается
    // откликнуться на заявку, и винит в этом площадку, а не свою карту.
    await createNotifications(
      client,
      rows.map((r) => ({
        userId: r.executorId,
        kind: "subscription_expired" as const,
        text: "Подписка закончилась — отклики на заявки временно недоступны",
      })),
    );

    return rowCount ?? 0;
  });
}

/**
 * Предупреждение «подписка скоро кончится».
 *
 * Шлётся тем же ежедневным запуском. Повтор в тот же день гасит частичный
 * уникальный индекс (миграция 0007) — поэтому здесь не нужно ни хранить
 * «когда предупреждали в последний раз», ни бояться второго запуска скрипта.
 */
export async function notifyExpiringSubscriptions(daysAhead = 3): Promise<number> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ executorId: string; days: number }>(
      `select executor_id as "executorId",
              greatest(0, ceil(extract(epoch from current_period_end - now()) / 86400))::int as days
         from subscriptions
        where status in ('active', 'past_due')
          and cancel_at_period_end = false
          and current_period_end > now()
          and current_period_end <= now() + make_interval(days => $1)
        limit 1000`,
      [daysAhead],
    );

    return createNotifications(
      client,
      rows.map((r) => ({
        userId: r.executorId,
        kind: "subscription_expiring" as const,
        text:
          r.days <= 1
            ? "Подписка заканчивается сегодня — продлите, чтобы не потерять доступ к откликам"
            : `Подписка заканчивается через ${r.days} ${dayWord(r.days)} — продление спишется автоматически`,
      })),
    );
  });
}

/** «через 2 дня», а не «через 2 день». */
function dayWord(n: number): string {
  const tail = n % 100 >= 11 && n % 100 <= 14 ? 2 : Math.min(n % 10, 5);
  return tail === 1 ? "день" : tail >= 2 && tail <= 4 ? "дня" : "дней";
}
