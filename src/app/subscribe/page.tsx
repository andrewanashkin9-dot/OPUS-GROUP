import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { requireUser } from "@/lib/server/auth/guard";
import { findUserById } from "@/lib/server/auth/users";
import { readAccessState } from "@/lib/server/payments/access";
import { getTKassaConfig, isBillingEnabled } from "@/lib/server/payments/config";
import { query } from "@/lib/server/db";
import { SubscribeForm } from "./SubscribeForm";

export const metadata: Metadata = {
  title: "Подписка Technic — OPUS GROUP",
  description: "Отклики без ограничений, отметка «Technic» в выдаче бригад и точные размеры в конструкторе — 700 ₽ в месяц.",
};

export const dynamic = "force-dynamic";

/**
 * Экран оформления подписки.
 *
 * До этого кнопка «Оформить подписку» на главной вела на `/start` — экран
 * выбора, что строить. Так вышло потому, что тарифный блок написали раньше,
 * чем появилась оплата: вести было некуда, и кнопку скопировали с соседней
 * «Начать бесплатно».
 *
 * Второй заход по тому же адресу: страница была закрытой, и гостя с неё
 * уводило на форму входа. Витрину тарифа закрывать нельзя — человек должен
 * сначала увидеть, что покупает, и только потом входить. Поэтому здесь
 * `requireUser` не разворачивает, а лишь решает, что показать: гостю —
 * описание и кнопку «Войти и оформить», вошедшему — его собственное
 * состояние.
 *
 * Ничего закрытого на странице нет: цена и список возможностей одинаковы для
 * всех, а платит всё равно тот, кто вошёл, — маршрут оплаты проверяет права
 * сам.
 */
export default async function SubscribePage() {
  // Готов ли приём платежей — решает сервер, а не браузер по ответу об
  // ошибке. Иначе единственный способ узнать, что оплата не подключена, —
  // нажать кнопку и получить красное сообщение, похожее на поломку.
  const paymentsReady = isBillingEnabled() && getTKassaConfig() !== null;

  const auth = await requireUser();
  const user = auth.ok ? await findUserById(auth.user.id) : null;

  // Гость и человек с заблокированной учётной записью видят одно и то же —
  // витрину. Разница вскроется на кнопке оплаты, и это правильное место:
  // до неё объяснять «вам нельзя» не за что.
  if (!user || user.status !== "active") {
    return (
      <>
        <NavBar />
        <main className="mx-auto min-h-[60vh] w-full max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-body-s text-dim">Тариф</p>
          <h1 className="font-display mt-2 text-h1 font-extrabold text-white">
            Подписка Technic
          </h1>
          <SubscribeForm
            role="guest"
            isExecutor={false}
            paymentsReady={paymentsReady}
            isGuest
            usedResponses={0}
            hasActiveSubscription={false}
            paidUntil={null}
            subscriptionStatus={null}
          />
        </main>
        <Footer />
      </>
    );
  }

  // Подписка в этом проекте — для исполнителей: она снимает лимит на отклики
  // и помечает бригаду в выдаче. Заказчику платить не за что, и вместо
  // кнопки, которая ответит 403, ему объясняется, почему.
  const isExecutor = user.role === "executor";

  const access = isExecutor
    ? await readAccessState(user.id)
    : { usedResponses: 0, hasActiveSubscription: false, allowed: true };

  const { rows } = await query<{ status: string; paidUntil: Date }>(
    `select status, current_period_end as "paidUntil"
       from subscriptions
      where executor_id = $1 and status in ('active', 'past_due')
      limit 1`,
    [user.id],
  );
  const current = rows[0] ?? null;

  return (
    <>
      <NavBar />
      <main className="mx-auto min-h-[60vh] w-full max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-body-s text-dim">Тариф</p>
        <h1 className="font-display mt-2 text-h1 font-extrabold text-white">
          Подписка Technic
        </h1>

        <SubscribeForm
          role={user.role}
          isExecutor={isExecutor}
          paymentsReady={paymentsReady}
          isGuest={false}
          usedResponses={access.usedResponses}
          hasActiveSubscription={access.hasActiveSubscription}
          paidUntil={
            current ? new Date(current.paidUntil).toLocaleDateString("ru-RU") : null
          }
          subscriptionStatus={current?.status ?? null}
        />
      </main>
      <Footer />
    </>
  );
}
