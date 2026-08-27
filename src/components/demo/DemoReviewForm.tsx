"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApiFetch } from "@/lib/auth/useApiFetch";
import { useRoleCookie } from "@/lib/auth/useRoleCookie";

/**
 * TODO: удалить перед запуском — временное тестовое послабление.
 *
 * Форма отзыва прямо на карточке бригады: оценка и текст, от любого
 * вошедшего пользователя, без завершённой заявки.
 *
 * Настоящая форма живёт в кабинете, на карточке завершённой заявки, и
 * появляется там только у того, кто эту работу заказал. Эта существует
 * ровно для того, чтобы саму форму можно было потрогать руками, не проходя
 * каждый раз путь заявка → отклик → принятие → завершение.
 *
 * Оформлена нарочито временно — пунктирная рамка и слово «временно», — чтобы
 * её нельзя было принять за часть готового интерфейса и забыть убрать.
 * Удаляется вместе с миграцией 0010 и маршрутом /api/executors/[id]/review.
 */
export function DemoReviewForm({
  executorId,
  executorName,
}: {
  executorId: string;
  executorName: string;
}) {
  const signedIn = useRoleCookie() !== null;
  const call = useApiFetch();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Гостю форма не показывается: маршрут всё равно ответит 401, и кнопка,
  // которая гарантированно не сработает, — это не приглашение, а ловушка.
  if (!signedIn) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { ok, data } = await call<{ error?: string }>(
      `/api/executors/${executorId}/review`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      },
    );

    if (!ok) {
      setError(data.error ?? "Не получилось");
      setPending(false);
      return;
    }

    setDone(true);
    setPending(false);
    // Список бригад приходит с сервера — перерисовываем страницу, чтобы
    // новый отзыв и пересчитанный рейтинг появились сразу.
    router.refresh();
  }

  if (done) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-success/60 px-3 py-2 text-caption text-success">
        Отзыв сохранён. Обновите страницу, если рейтинг ещё не пересчитался.
      </p>
    );
  }

  return (
    <div
      className="mt-4 rounded-2xl border border-dashed p-3"
      style={{ borderColor: "rgba(255,215,0,0.45)" }}
    >
      <p className="text-caption font-bold uppercase text-accent">
        Временно · форма отзыва
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-body-s font-medium text-accent underline underline-offset-2"
        >
          Оставить отзыв о «{executorName}»
        </button>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <fieldset>
            <legend className="text-caption text-cream-dim">Оценка</legend>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  aria-label={`${value} из 5`}
                  aria-pressed={rating === value}
                  className={`text-h3 leading-none transition-colors ${
                    value <= rating ? "text-accent" : "text-cream-dim"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-caption text-cream-dim">Комментарий (необязательно)</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded-xl border border-[var(--plate-edge)] bg-transparent p-2 text-body-s text-cream outline-none focus:border-cream-dim"
              placeholder="Что понравилось, что нет"
            />
          </label>

          {error && (
            <p role="alert" className="text-caption text-error">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-accent px-4 py-2 text-body-s font-bold text-deep transition-[filter] hover:brightness-108 disabled:opacity-60"
            >
              {pending ? "Отправляем…" : "Отправить"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-[var(--plate-edge)] px-4 py-2 text-body-s text-cream"
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
