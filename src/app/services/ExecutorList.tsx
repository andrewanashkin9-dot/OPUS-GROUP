"use client";

import { useMemo, useState } from "react";
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
 */

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
          {visible.map((crew) => {
            const requested = requestedIds.has(crew.id);
            return (
              <li key={crew.id} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-h3 font-medium text-cream-bright">
                      {crew.displayName}
                    </h2>
                    <p className="mt-1 text-body-s text-cream-dim">{crew.city ?? "город не указан"}</p>
                  </div>
                  {crew.hasActiveSubscription && (
                    <span className="ingot shrink-0 rounded-full px-2.5 py-1 text-caption font-bold">
                      Technic
                    </span>
                  )}
                </div>

                <Reputation completed={crew.completedDeals} rate={crew.completionRate} />

                {crew.bio && <p className="mt-4 flex-1 text-body-s text-cream-dim">{crew.bio}</p>}

                {crew.specialties.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {crew.specialties.map((kind) => (
                      <span
                        key={kind}
                        className="rounded-full border border-line px-2.5 py-1 text-caption uppercase text-cream-dim"
                      >
                        {nodeKindLabel(kind as NodeKind)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
                  <span className="text-body-s font-medium text-cream">
                    {crew.priceHint ?? "цена по смете объекта"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRequestedIds((prev) => new Set(prev).add(crew.id))}
                    disabled={requested}
                    className="inline-flex items-center rounded-full bg-cream px-4 py-2 text-body-s font-bold text-bg transition-colors hover:bg-cream-bright disabled:border disabled:border-success disabled:bg-transparent disabled:text-success"
                  >
                    {requested ? "Заявка отправлена ✓" : "Запросить смету"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * Репутация словами, а не звёздами.
 *
 * У новой бригады сделок нет — и честнее написать «пока без завершённых
 * заявок», чем показать ей ноль звёзд, который читается как «плохая».
 */
function Reputation({ completed, rate }: { completed: number; rate: number | null }) {
  if (completed === 0) {
    return (
      <p className="mt-3 text-body-s text-cream-dim">
        Пока без завершённых заявок
      </p>
    );
  }
  return (
    <p className="mt-3 text-body-s text-cream">
      {completed} {plural(completed, "завершённая заявка", "завершённые заявки", "завершённых заявок")}
      {rate !== null && rate < 1 && (
        <span className="text-cream-dim"> · доведено до конца {Math.round(rate * 100)}%</span>
      )}
    </p>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
