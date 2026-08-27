import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";

/**
 * Оценка — одинаково у бригад и у товаров.
 *
 * Вынесено из карточки бригады, когда та же строка понадобилась в магазине.
 * Дело не в экономии кода: «★ 4,6 · 12 отзывов» в одном месте и «4.6 (12)» в
 * другом читаются как две разные шкалы, и человек начинает сравнивать
 * несравнимое.
 *
 * Главное правило здесь одно: **у предмета без отзывов нет нуля звёзд.**
 * Пустые звёзды читаются как «плохо», хотя на самом деле означают «никто
 * ещё не высказался», а это совсем другая новость.
 */

export function RatingLine({
  average,
  count,
  empty,
  locale = DEFAULT_LOCALE,
  className = "",
}: {
  average: number | null;
  count: number;
  /** Что писать, когда отзывов нет. У товара и у бригады формулировка своя. */
  empty?: string;
  locale?: Locale;
  className?: string;
}) {
  const t = getDictionary(locale).services;

  if (average === null || count === 0) {
    return <p className={`text-body-s text-cream-dim ${className}`}>{empty ?? t.noReviews}</p>;
  }

  return (
    <p className={`text-body-s text-cream ${className}`}>
      <span className="font-bold text-accent" aria-hidden="true">
        ★
      </span>{" "}
      <span className="font-bold tabular-nums">{average.toFixed(1)}</span>
      <span className="text-cream-dim">
        {" · "}
        {t.reviews(count)}
      </span>
    </p>
  );
}

/**
 * Пять звёзд, из которых закрашено столько, сколько поставили.
 *
 * Звёзды — картинка, и голосом «★★★★★» ничего не значит: программе чтения
 * отдаётся фраза, а сами символы от неё скрыты целиком.
 */
export function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  return (
    <span aria-label={`Оценка ${rating} из 5`} role="img" className={className}>
      <span aria-hidden="true" className="font-bold text-accent">
        {"★".repeat(rating)}
      </span>
      <span aria-hidden="true" className="text-cream-dim">
        {"★".repeat(5 - rating)}
      </span>
    </span>
  );
}
