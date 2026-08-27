"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { useApiFetch } from "@/lib/auth/useApiFetch";

/**
 * Подписка исполнителя.
 *
 * Оплата идёт **на стороне банка**: мы получаем ссылку и уводим человека
 * туда. Реквизиты карты к нам не попадают никогда — поэтому приложение не
 * подпадает под требования к хранению карточных данных.
 */
export function SubscriptionPanel({
  status,
  paidUntil,
}: {
  status: string | null;
  paidUntil: string | null;
}) {
  const call = useApiFetch();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const active = status === "active" || status === "past_due";

  async function subscribe() {
    setPending(true);
    setError(null);
    const { ok, data } = await call<{ paymentUrl?: string; error?: string }>(
      "/api/subscriptions/checkout",
      { method: "POST" },
    );
    if (ok && data.paymentUrl) {
      // Уходим на страницу банка. Обычный переход, а не router.push: адрес
      // чужой, и маршрутизатору Next там делать нечего.
      window.location.href = data.paymentUrl;
      return;
    }
    setError(data.error ?? "Не удалось начать оплату");
    setPending(false);
  }

  return (
    <section className="mt-14 rounded-3xl border border-line p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-h3 font-extrabold text-cream-bright">Подписка Technic</h2>
          <p className="mt-2 text-body-s text-cream-dim">
            {active
              ? `Оплачена до ${paidUntil ?? "—"}${status === "past_due" ? " · платёж не прошёл, продлеваем" : ""}`
              : "Приоритетные заявки, точные размеры и расширенная библиотека материалов."}
          </p>
        </div>
        {/* Кнопка была variant="ingot": в редизайне основной ветки этот
            вариант и класс .ingot убраны, платный тариф обозначается
            акцентом — а акцент теперь и есть primary. */}
        {!active && (
          <Button onClick={subscribe} disabled={pending}>
            {pending ? "Готовим оплату…" : "Оформить за 700 ₽/мес"}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl border border-error/40 px-4 py-3 text-body-s text-error">
          {error}
        </p>
      )}
    </section>
  );
}
