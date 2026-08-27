"use client";

import Link from "next/link";
import { RatingLine } from "@/components/Rating";
import { formatRub } from "@/lib/format";
import { useProductRatings } from "@/lib/product-ratings";
import type { Product } from "@/lib/marketplace";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/locale";
import { brandLabel, categoryText, priceUnitText, productText } from "@/lib/i18n/product-text";
import { AddToCart } from "./AddToCart";
import { ProductPhoto } from "./ProductPhoto";

/**
 * One product in the grid.
 *
 * The whole card opens the product; the "в смету" control sits on top of it.
 * A button nested inside a link is invalid markup and unusable with a
 * keyboard, so the link is stretched across the card with a pseudo-element
 * instead, and the button is lifted above it.
 */

interface ProductCardProps {
  product: Product;
  /** Marks a product that covers a surface in the reader's own model. */
  fitsModel?: boolean;
  priority?: boolean;
  locale?: Locale;
}

export function ProductCard({
  product,
  fitsModel = false,
  priority,
  locale = DEFAULT_LOCALE,
}: ProductCardProps) {
  const t = getDictionary(locale).market;
  const text = productText(product, locale);
  // Оценка приезжает после отрисовки, поэтому карточка и вся страница
  // каталога остаются заранее собранными. Пока не приехала — строки нет
  // вовсе, а не «пока нет отзывов»: у товара без единого отзыва и у товара,
  // чью оценку ещё везут, разный смысл, и мигать между ними некрасиво.
  const rating = useProductRatings()[product.id];

  return (
    <article className="plate plate-lift relative flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-[var(--plate-edge)] bg-bg">
        <ProductPhoto id={product.id} alt={text.name} priority={priority} />
        {fitsModel && (
          <span className="absolute left-3 top-3 rounded-full border border-cream-dim bg-bg/80 px-2.5 py-1 text-caption uppercase text-cream-bright backdrop-blur">
            {t.fitsModel}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-caption uppercase text-cream-dim">
          <span>{categoryText(product.category, locale)}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{brandLabel(product.brand, locale)}</span>
        </div>

        <h3 className="font-display mt-2 text-body-l font-semibold leading-snug text-white">
          <Link
            href={localePath(locale, `/market/${product.id}`)}
            className="outline-offset-4 after:absolute after:inset-0 after:content-['']"
          >
            {text.name}
          </Link>
        </h3>

        {rating && (
          <RatingLine
            average={rating.average}
            count={rating.count}
            locale={locale}
            className="mt-2"
          />
        )}

        <p className="mt-2 line-clamp-3 flex-1 text-body-s text-cream-dim">
          {text.summary}
        </p>

        <div className="mt-5 flex items-end justify-between gap-3 border-t border-[var(--plate-edge)] pt-4">
          <span>
            <span className="font-display block text-h3 font-semibold tabular-nums text-accent">
              {formatRub(product.price)}
            </span>
            <span className="text-caption uppercase text-cream-dim">
              {priceUnitText(product.unit, locale)}
            </span>
          </span>
          <AddToCart product={product} compact locale={locale} />
        </div>
      </div>
    </article>
  );
}
