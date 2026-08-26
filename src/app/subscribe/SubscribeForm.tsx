"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/Button";
import { useApiFetch } from "@/lib/auth/useApiFetch";

/**
 * Кнопка, которая действительно начинает оплату.
 *
 * Нажатие идёт на наш маршрут, тот заводит платёж в Т-Кассе и возвращает
 * ссылку на её страницу — туда и уходит человек. Реквизиты карты вводятся у
 * банка и к нам не попадают никогда.
 */

const FREE_RESPONSES = 1;
const PRICE = "700 ₽";

export function SubscribeForm({
  isExecutor,
  usedResponses,
  hasActiveSubscription,
  paidUntil,
  subscriptionStatus,
}: {
  role: string;
  isExecutor: boolean;
  usedResponses: number;
  hasActiveSubscription: boolean;
  paidUntil: string | null;
  subscriptionStatus: string | null;
}) {
  const call = useApiFetch();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function subscribe() {
    setPending(true);
    setError(null);
    const { ok, data } = await call<{ paymentUrl?: string; error?: string }>(
      "/api/subscriptions/checkout",
      { method: "POST" },
    );
    if (ok && data.paymentUrl) {
      // Адрес чужой — обычный переход, а не маршрутизатор Next.
      window.location.href = data.paymentUrl;
      return;
    }
    setError(data.error ?? "Не удалось начать оплату");
    setPending(false);
  }

  if (!isExecutor) {
    return (
      <div className="plate mt-8 p-6">
        <p className="text-body text-soft">
          Подписка нужна бригадам: она снимает ограничение на отклики и
          отмечает исполнителя в выдаче. Как заказчику вам платить не за что —
          заявки, отклики и смета работают бесплатно.
        </p>
        <Link
          href="/cabinet"
          className="mt-6 inline-flex items-center rounded-full border border-[var(--plate-edge)] px-5 py-3 text-ui font-bold text-white transition-colors hover:border-[var(--plate-edge-hi)]"
        >
          В кабинет
        </Link>
      </div>
    );
  }

  if (hasActiveSubscription) {
    return (
      <div className="plate mt-8 p-6">
        <p className="text-body text-white">
          Подписка оплачена до {paidUntil ?? "—"}.
        </p>
        {subscriptionStatus === "past_due" && (
          <p className="mt-2 text-body-s text-warning">
            Последний платёж не прошёл — доступ пока сохранён, спишем ещё раз.
          </p>
        )}
        <p className="mt-4 text-body-s text-dim">
          Отклики без ограничений. Продление списывается автоматически.
        </p>
      </div>
    );
  }

  const freeLeft = Math.max(0, FREE_RESPONSES - usedResponses);

  return (
    <div className="plate mt-8 p-6">
      <p className="font-display text-h1 font-extrabold text-accent">
        {PRICE}
        <span className="text-body-l font-medium text-dim"> / мес.</span>
      </p>

      <p className="mt-4 text-body text-soft">
        {freeLeft > 0
          ? "Первый отклик на заявку — бесплатно. Дальше нужна подписка."
          : "Бесплатный отклик уже использован. Чтобы откликаться дальше, нужна подписка."}
      </p>

      <ul className="mt-6 space-y-2 text-body-s text-soft">
        <li>· Отклики на заявки без ограничений</li>
        <li>· Отметка «Technic» в выдаче бригад</li>
        <li>· Точные размеры и полная спецификация в конструкторе</li>
      </ul>

      {error && (
        <p role="alert" className="mt-6 rounded-2xl border border-error/40 px-4 py-3 text-body-s text-error">
          {error}
        </p>
      )}

      <Button className="mt-8 w-full" onClick={subscribe} disabled={pending}>
        {pending ? "Готовим оплату…" : `Оплатить ${PRICE}`}
      </Button>

      <p className="mt-4 text-caption text-dim">
        Оплата на стороне банка. Данные карты к нам не попадают.
      </p>
    </div>
  );
}
