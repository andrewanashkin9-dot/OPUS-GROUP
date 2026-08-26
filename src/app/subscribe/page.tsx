import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { requireUser } from "@/lib/server/auth/guard";
import { findUserById } from "@/lib/server/auth/users";
import { readAccessState } from "@/lib/server/payments/access";
import { query } from "@/lib/server/db";
import { SubscribeForm } from "./SubscribeForm";

export const metadata: Metadata = {
  title: "Подписка Technic — OPUS GROUP",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Экран оформления подписки.
 *
 * До этого кнопка «Оформить подписку» на главной вела на `/start` — экран
 * выбора, что строить. Так вышло потому, что тарифный блок написали раньше,
 * чем появилась оплата: вести было некуда, и кнопку скопировали с соседней
 * «Начать бесплатно». Теперь есть куда.
 *
 * Страница серверная: состояние подписки и остаток бесплатных откликов
 * читаются у базы. Гостя до неё не доводит proxy — он уходит на форму входа.
 */
export default async function SubscribePage() {
  const auth = await requireUser();
  if (!auth.ok) redirect("/login?next=/subscribe");

  const user = await findUserById(auth.user.id);
  if (!user || user.status !== "active") redirect("/login?next=/subscribe");

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
