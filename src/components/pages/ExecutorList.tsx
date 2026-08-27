"use client";

import { useMemo, useState } from "react";
import { DemoDataBadge } from "@/components/DemoDataBadge";
import { RatingLine, Stars } from "@/components/Rating";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { Reveal } from "@/components/ui/Reveal";
// ⚠️ ВРЕМЕННОЕ ТЕСТОВОЕ ПОСЛАБЛЕНИЕ — удалить вместе с миграцией 0010.
import { DemoReviewForm } from "@/components/demo/DemoReviewForm";
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
  /** ⚠️ ВРЕМЕННО: отзыв из сид-скрипта. Удалить вместе с сидом. */
  isDemo?: boolean;
}

/** ⚠️ ВРЕМЕННО: метка, которой сид помечает свои тексты в базе. */
const DEMO_PREFIX = "[демо] ";

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

export function ExecutorList({
  executors,
  demo,
  locale = DEFAULT_LOCALE,
}: {
  executors: ExecutorCard[];
  /** Это образцы карточек, а не зарегистрированные бригады. */
  demo: boolean;
  locale?: Locale;
}) {
  const t = getDictionary(locale).services;
  const model = useAppStore((s) => s.model);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  // The switch holds the reader's override, not the state itself. Seeding
  // useState from `model` looked equivalent and was not: the project store
  // hydrates from localStorage in an effect, so on the first render `model`
  // is always null — the initial value was captured as "show everything" and
  // never changed. The page then said it was showing only the crews that fit
  // your house while listing every crew there is.
  const [showAllOverride, setShowAllOverride] = useState<boolean | null>(null);
  const showAll = showAllOverride ?? !model;

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
        {demo ? t.demoLede : model ? t.modelLede : t.modelHint}
      </p>

      {/* Пометка стоит над карточками, а не под ними: человек должен узнать,
          что бригады выдуманы, до того как выберет одну, а не после. */}
      {demo && (
        <p
          role="status"
          className="prose-measure mt-4 rounded-xl border border-[var(--plate-edge)] px-4 py-3 text-body-s"
          style={{ color: "var(--warning)" }}
        >
          {t.demoNotice}
        </p>
      )}

      {/* Переключатель нужен и на образцах: половина смысла раздела — что
          список сам сужается под дом, и без кнопки «показать всех» человек с
          односкатной крышей увидит одну карточку и упрётся. */}
      {model && (
        <button
          type="button"
          onClick={() => setShowAllOverride(!showAll)}
          className="mt-6 text-body-s font-medium text-cream underline underline-offset-2 hover:text-cream-bright"
        >
          {showAll ? t.onlyMine : t.showAll}
        </button>
      )}

      {visible.length === 0 ? (
        <p className="mt-10 text-body-s text-cream-dim">
          {t.empty}
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
                          {crew.city ?? t.noCity}
                        </p>
                      </div>
                      {crew.hasActiveSubscription && (
                        <span className="shrink-0 rounded-full border border-[var(--accent-line)] px-2.5 py-1 text-caption font-bold uppercase text-accent">
                          Technic
                        </span>
                      )}
                    </div>

                    <Reputation
                  locale={locale}
                  completed={crew.completedDeals}
                  rate={crew.completionRate}
                  average={crew.ratingAverage}
                  reviewCount={crew.reviewCount}
                />

                    {crew.bio && (
                      <p className="mt-4 flex-1 text-body-s text-cream-dim">{crew.bio}</p>
                    )}

                    {/* ⚠️ ВРЕМЕННО: подпись у демо-отзывов, пропадёт вместе
                        с тестовыми данными. */}
                    {crew.reviews.length > 0 && crew.reviews.every((r) => r.isDemo) && (
                      <DemoDataBadge locale={locale} className="mt-4" />
                    )}

                    {crew.reviews.length > 0 && (
                  <ul className="mt-4 space-y-3 border-t border-[var(--plate-edge)] pt-4">
                    {crew.reviews.map((review) => (
                      <li key={review.id}>
                        <p className="text-caption text-cream-dim">
                          {/* Звёзды — картинка, и голосом «★★★★★» ничего не
                              значит. Программе чтения отдаётся фраза, а сами
                              символы от неё скрыты целиком. */}
                          <Stars rating={review.rating} />{" "}
                          {review.authorName}
                        </p>
                        {review.comment && (
                          <p className="mt-1 text-body-s text-cream-dim">
                            «{review.comment.startsWith(DEMO_PREFIX) ? review.comment.slice(DEMO_PREFIX.length) : review.comment}»
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* ⚠️ ВРЕМЕННО: форма отзыва без завершённой заявки. У
                        образцов её нет — отзыв о выдуманной бригаде не имеет
                        смысла и сохранить его некуда. */}
                    {!demo && (
                      <DemoReviewForm executorId={crew.id} executorName={crew.displayName} />
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
                        {crew.priceHint ?? t.noPrice}
                      </span>
                      {/* У образца нет кнопки. Полноценная акцентная кнопка,
                          которая ничего не делает, — это обещание, а обещать
                          тут некому: бригады выдуманы. Место действия при
                          этом остаётся на виду, чтобы карточка показывала,
                          как она будет выглядеть по-настоящему. */}
                      {demo ? (
                        <span className="text-body-s text-cream-dim">
                          {t.demoNoCta}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setRequestedIds((prev) => new Set(prev).add(crew.id))
                          }
                          disabled={requested}
                          className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-body-s font-bold text-deep shadow-[var(--lift-1)] transition-[filter] hover:brightness-108 disabled:border disabled:border-success disabled:bg-transparent disabled:text-success disabled:shadow-none"
                        >
                          {requested ? t.requestSent : t.requestQuote}
                        </button>
                      )}
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
  locale,
  completed,
  rate,
  average,
  reviewCount,
}: {
  locale: Locale;
  completed: number;
  rate: number | null;
  average: number | null;
  reviewCount: number;
}) {
  const t = getDictionary(locale).services;

  return (
    <div className="mt-3 space-y-1">
      <RatingLine average={average} count={reviewCount} locale={locale} />

      {completed === 0 ? (
        <p className="text-body-s text-cream-dim">{t.noDeals}</p>
      ) : (
        <p className="text-body-s text-cream-dim">
          {t.completed(completed)}
          {rate !== null && rate < 1 && t.completionRate(Math.round(rate * 100))}
        </p>
      )}
    </div>
  );
}

