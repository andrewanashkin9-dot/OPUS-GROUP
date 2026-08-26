"use client";

import { useMemo, useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { nodeKindLabel, useAppStore } from "@/lib/store";
import type { NodeKind } from "@/lib/3d/types";

/**
 * Список бригад.
 *
 * Раньше здесь лежал массив из шести выдуманных бригад с выдуманными
 * рейтингами. Теперь данные приходят из базы, и это меняет одну важную вещь:
 * **репутацию больше нельзя нарисовать.**
 *
 * Поэтому и звёзд больше нет. Звезда требует отзывов, а отзывов у нас пока не
 * собирают; «★ 4.9» без единого отзыва — это просто картинка, вводящая
 * заказчика в заблуждение. Вместо неё показывается то, что действительно
 * известно из базы: сколько заявок бригада довела до конца.
 *
 * Оформление карточки (plate, Reveal, акцентная кнопка) пришло из редизайна
 * основной ветки и сохранено целиком — вместе с min-w-0 и flex-wrap, которые
 * там чинили горизонтальную прокрутку на узких экранах.
 */

export interface ReviewCard {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: string | Date;
}

export interface ExecutorCard {
  id: string;
  displayName: string;
  city: string | null;
  specialties: string[];
  bio: string | null;
  priceHint: string | null;
  completedDeals: number;
  cancelledDeals: number;
  completionRate: number | null;
  hasActiveSubscription: boolean;
  ratingAverage: number | null;
  reviewCount: number;
  reviews: ReviewCard[];
}

export function ExecutorList({ executors }: { executors: ExecutorCard[] }) {
  const model = useAppStore((s) => s.model);
  const [showAll, setShowAll] = useState(!model);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const requiredKinds = useMemo<NodeKind[]>(() => {
    if (!model) return [];
    return Array.from(new Set(model.nodes.map((n) => n.kind)));
  }, [model]);

  const visible = showAll
    ? executors
    : executors.filter((e) =>
        e.specialties.some((s) => requiredKinds.includes(s as NodeKind)),
      );

  return (
    <>
      <p className="prose-measure mt-4 text-body-l text-cream-dim">
        {model
          ? "Показаны бригады, которые закрывают именно те работы, что есть в вашей модели."
          : "Постройте модель дома в конструкторе — и здесь останутся только нужные вам бригады."}
      </p>

      {model && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-6 text-body-s font-medium text-cream underline underline-offset-2 hover:text-cream-bright"
        >
          {showAll ? "Показать только нужные для моей модели" : "Показать все бригады"}
        </button>
      )}

      {visible.length === 0 ? (
        <p className="mt-10 text-body-s text-cream-dim">
          {executors.length === 0
            ? "Бригады ещё не зарегистрировались."
            : "Под вашу модель пока никто не подходит — посмотрите всех."}
        </p>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2">
          {visible.map((crew, i) => {
            const requested = requestedIds.has(crew.id);
            return (
              <li key={crew.id} className="h-full">
                <Reveal index={i} className="h-full">
                  <div className="plate plate-lift flex h-full flex-col p-6">
                    {/* min-w-0 and flex-wrap on purpose: a flex item cannot
                        shrink below its min-content by default, so a long crew
                        name («ФундаментСтрой») was widening the grid track,
                        then main, then the document — a 35 px horizontal
                        scroll on a 390 px screen. */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-display text-h3 font-medium break-words text-cream-bright">
                          {crew.displayName}
                        </h2>
                        <p className="mt-1 text-body-s text-cream-dim">
                          {crew.city ?? "город не указан"}
                        </p>
                      </div>
                      {crew.hasActiveSubscription && (
                        <span className="shrink-0 rounded-full border border-[var(--accent-line)] px-2.5 py-1 text-caption font-bold uppercase text-accent">
                          Technic
                        </span>
                      )}
                    </div>

                    <Reputation
                  completed={crew.completedDeals}
                  rate={crew.completionRate}
                  average={crew.ratingAverage}
                  reviewCount={crew.reviewCount}
                />

                    {crew.bio && (
                      <p className="mt-4 flex-1 text-body-s text-cream-dim">{crew.bio}</p>
                    )}

                    {crew.reviews.length > 0 && (
                  <ul className="mt-4 space-y-3 border-t border-[var(--plate-edge)] pt-4">
                    {crew.reviews.map((review) => (
                      <li key={review.id}>
                        <p className="text-caption text-cream-dim">
                          {/* Звёзды — картинка, и голосом «★★★★★» ничего не
                              значит. Программе чтения отдаётся фраза, а сами
                              символы от неё скрыты целиком. */}
                          <span aria-label={`Оценка ${review.rating} из 5`} role="img">
                            <span aria-hidden="true" className="font-bold text-accent">
                              {"★".repeat(review.rating)}
                            </span>
                            <span aria-hidden="true">{"★".repeat(5 - review.rating)}</span>
                          </span>{" "}
                          {review.authorName}
                        </p>
                        {review.comment && (
                          <p className="mt-1 text-body-s text-cream-dim">«{review.comment}»</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {crew.specialties.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {crew.specialties.map((kind) => (
                          <span
                            key={kind}
                            className="rounded-full border border-[var(--plate-edge)] px-2.5 py-1 text-caption uppercase text-cream-dim"
                          >
                            {nodeKindLabel(kind as NodeKind)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--plate-edge)] pt-4">
                      <span className="text-body-s font-medium text-cream">
                        {crew.priceHint ?? "цена по смете объекта"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRequestedIds((prev) => new Set(prev).add(crew.id))}
                        disabled={requested}
                        className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-body-s font-bold text-deep shadow-[var(--lift-1)] transition-[filter] hover:brightness-108 disabled:border disabled:border-success disabled:bg-transparent disabled:text-success disabled:shadow-none"
                      >
                        {requested ? "Заявка отправлена ✓" : "Запросить смету"}
                      </button>
                    </div>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * Репутация: оценка людей и сухая статистика по заявкам.
 *
 * Двумя строками, потому что это разные вещи. Рейтинг — мнение заказчиков,
 * доля завершённых — факт из базы. Слепить их в одно число значит выдать
 * оценку там, где её никто не ставил.
 *
 * Ни у одной из строк нет вида по умолчанию «ноль»: у новой бригады написано
 * «пока нет отзывов», а не пять пустых звёзд — пустые звёзды читаются как
 * «плохая», хотя её просто ещё никто не нанимал.
 */
function Reputation({
  completed,
  rate,
  average,
  reviewCount,
}: {
  completed: number;
  rate: number | null;
  average: number | null;
  reviewCount: number;
}) {
  return (
    <div className="mt-3 space-y-1">
      {average === null ? (
        <p className="text-body-s text-cream-dim">Пока нет отзывов</p>
      ) : (
        <p className="text-body-s text-cream">
          <span className="font-bold text-accent" aria-hidden="true">
            ★
          </span>{" "}
          <span className="font-bold tabular-nums">
            {/* toFixed(1), потому что «4,7» человек читает, а «4,7000000001» нет */}
            {average.toFixed(1)}
          </span>
          <span className="text-cream-dim">
            {" · "}
            {reviewCount} {plural(reviewCount, "отзыв", "отзыва", "отзывов")}
          </span>
        </p>
      )}

      {completed === 0 ? (
        <p className="text-body-s text-cream-dim">Пока без завершённых заявок</p>
      ) : (
        <p className="text-body-s text-cream-dim">
          {completed}{" "}
          {plural(completed, "завершённая заявка", "завершённые заявки", "завершённых заявок")}
          {rate !== null && rate < 1 && <> · доведено до конца {Math.round(rate * 100)}%</>}
        </p>
      )}
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
