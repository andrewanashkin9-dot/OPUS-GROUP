/**
 * Ежемесячные списания по подпискам.
 *
 *     npm run billing:charge
 *
 * Ставить на ежедневный запуск (Cron Job на Vercel или обычный cron). Каждый
 * день скрипт берёт подписки, у которых оплаченный период закончился, и
 * списывает следующий по сохранённой карте — человека при этом никуда не
 * отправляют, в этом и смысл автоматического продления.
 *
 * Раз в сутки, а не раз в месяц: «раз в месяц» означает один шанс в году
 * что-то не заметить, а ежедневный запуск сам догоняет пропущенное.
 *
 * Успех подтверждается **не ответом банка, а уведомлением** на вебхук: ответ
 * означает лишь «списание принято в работу». Поэтому здесь подписка не
 * продлевается — это делает обработчик уведомления.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const { getTKassaConfig, isBillingEnabled } = await import("../src/lib/server/payments/config");
  const { initPayment, chargeRecurrent, rublesToKopecks, TKassaError } = await import(
    "../src/lib/server/payments/tkassa"
  );
  const {
    listDueSubscriptions,
    markPastDue,
    expireStaleSubscriptions,
    notifyExpiringSubscriptions,
  } = await import("../src/lib/server/payments/subscriptions");
  const { query, getPool } = await import("../src/lib/server/db");

  const pool = getPool();
  try {
    if (!isBillingEnabled()) {
      console.log("Списания выключены (TKASSA_ENABLED). Ничего не делаю.");
      return;
    }
    const config = getTKassaConfig();
    if (!config) {
      console.log("Ключи Т-Кассы не заданы. Ничего не делаю.");
      return;
    }

    const due = await listDueSubscriptions();
    console.log(`Подписок к списанию: ${due.length}`);

    let charged = 0;
    let failed = 0;

    for (const subscription of due) {
      try {
        // Строка платежа заводится заранее, и её id уходит банку как OrderId —
        // так вернувшееся уведомление находит, к чему относится.
        const { rows } = await query<{ id: string }>(
          `insert into transactions (kind, status, user_id, subscription_id,
                                     gross_amount, net_amount)
           values ('subscription_fee', 'pending', $1, $2, $3, $3)
           returning id`,
          [subscription.executorId, subscription.id, subscription.priceAmount],
        );
        const orderId = rows[0].id;

        // Порядок обязателен: Init даёт новый PaymentId, Charge списывает по
        // нему и по сохранённому RebillId.
        const init = await initPayment(config, {
          orderId,
          amountKopecks: rublesToKopecks(subscription.priceAmount),
          description: "Продление подписки Technic, 30 дней",
          customerKey: subscription.executorId,
          recurrent: false,
        });

        await query(`update transactions set external_id = $2 where id = $1`, [
          orderId,
          init.PaymentId,
        ]);

        const result = await chargeRecurrent(config, {
          paymentId: init.PaymentId,
          rebillId: subscription.rebillId,
        });

        console.log(`  ${subscription.id}: списание принято, статус ${result.Status}`);
        charged++;
      } catch (error) {
        failed++;
        // Доступ не отбираем сразу: карту могли перевыпустить, на счёте могло
        // не хватить денег на день. Помечаем «просрочена» — доступ остаётся,
        // а через несколько дней подписка истечёт сама.
        await markPastDue(subscription.id);
        const detail =
          error instanceof TKassaError ? `${error.code ?? "—"} ${error.message}` : String(error);
        console.error(`  ${subscription.id}: не списалось — ${detail}`);
      }
    }

    const expired = await expireStaleSubscriptions(3);
    // Предупреждения — после списаний: у тех, кто только что оплатился,
    // период уже сдвинулся, и предупреждать их не о чем.
    const warned = await notifyExpiringSubscriptions(3);

    console.log(
      `\nПринято к списанию: ${charged}, не удалось: ${failed}, истекло: ${expired}, предупреждено: ${warned}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
