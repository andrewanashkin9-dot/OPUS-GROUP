"use client";

import { useEffect, useState } from "react";
import { RatingLine, Stars } from "@/components/Rating";
import { formatDate } from "@/lib/requests-ui";
import { useProductRatings } from "@/lib/product-ratings";

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
}

export function ProductReviews({ productId }: { productId: string }) {
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
        <h2 className="font-display text-h2 font-medium text-cream-bright">Отзывы</h2>
        <RatingLine
          average={rating?.average ?? null}
          count={rating?.count ?? 0}
          empty="Этот материал ещё никто не оценил"
        />
      </div>

      {reviews.length > 0 && (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id} className="plate p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Stars rating={review.rating} className="text-body-s" />
                <span className="text-caption text-cream-dim">
                  {formatDate(review.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-caption text-cream-dim">{review.authorName}</p>
              {review.comment && (
                <p className="mt-3 text-body-s text-soft">«{review.comment}»</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
