"use client";

import { useEffect, useState } from "react";
import { DemoDataBadge } from "@/components/DemoDataBadge";
import { RatingLine, Stars } from "@/components/Rating";
import { formatDate } from "@/lib/requests-ui";
import { useProductRatings } from "@/lib/product-ratings";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";

/**
 * Отзывы о товаре на его странице.
 *
 * Подгружаются после отрисовки — страница товара собирается заранее и
 * отдаётся с CDN, и терять это ради отзывов нельзя: каталог из тридцати семи
 * статических страниц, ставший динамическим, начинает думать на каждый заход.
 *
 * Средняя берётся из общего хранилища рейтингов — того же, из которого её
 * берут карточки каталога. Считать её здесь заново по пяти показанным
 * отзывам значило бы показать «★ 4,6» в каталоге и «★ 4,8» на странице
 * того же товара.
 */

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: string;
  /** TODO: удалить перед запуском — отзыв из сид-скрипта, а не от покупателя. */
  isDemo: boolean;
}

/** TODO: удалить перед запуском — метка, которой сид помечает свои тексты в базе. */
const DEMO_PREFIX = "[демо] ";

export function ProductReviews({
  productId,
  locale = DEFAULT_LOCALE,
}: {
  productId: string;
  locale?: Locale;
}) {
  const t = getDictionary(locale).market;
  const rating = useProductRatings()[productId];
  const [reviews, setReviews] = useState<Review[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/products/${productId}/reviews`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { reviews: [] }))
      .then((data: { reviews?: Review[] }) => {
        if (!cancelled) setReviews(data.reviews ?? []);
      })
      .catch(() => {
        // Отзывы не доехали — страница товара от этого не ломается.
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Пока ничего не приехало — блока нет. Пустая рамка с надписью
  // «загружаем» сдвигает страницу под руками у читающего.
  if (reviews === null) return null;

  return (
    <section className="mt-20 border-t border-[var(--plate-edge)] pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-h2 font-medium text-cream-bright">{t.reviews}</h2>
        <RatingLine
          average={rating?.average ?? null}
          count={rating?.count ?? 0}
          empty={t.noReviews}
          locale={locale}
        />
      </div>

      {/* TODO: удалить перед запуском — подпись у демо-отзывов. Показывается, только если все
          показанные отзывы заведены сид-скриптом; как только появится хоть
          один настоящий, подпись пропадёт сама. Удалять вместе с сидом. */}
      {reviews.length > 0 && reviews.every((r) => r.isDemo) && (
        <DemoDataBadge locale={locale} className="mt-4" />
      )}

      {reviews.length > 0 && (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id} className="plate p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Stars rating={review.rating} className="text-body-s" />
                <span className="text-caption text-cream-dim">
                  {formatDate(review.createdAt, locale)}
                </span>
              </div>
              <p className="mt-1 text-caption text-cream-dim">{review.authorName}</p>
              {review.comment && (
                // Метку «[демо]» из текста убираем при показе: в базе она
                // нужна, чтобы данные можно было найти и удалить, а в
                // цитате она мусор — про то же самое уже сказала подпись.
                <p className="mt-3 text-body-s text-soft">
                  «{review.comment.startsWith(DEMO_PREFIX) ? review.comment.slice(DEMO_PREFIX.length) : review.comment}»
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
