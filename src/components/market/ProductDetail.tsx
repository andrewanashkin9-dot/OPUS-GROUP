"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { RatingLine } from "@/components/Rating";
import { formatRub } from "@/lib/format";
import { useProductRatings } from "@/lib/product-ratings";
import {
  categoryLabel,
  marketUnitLabel,
  matchesModel,
  priceUnitLabel,
  PRODUCTS,
  suggestedQuantity,
  type Product,
} from "@/lib/marketplace";
import { useAppStore } from "@/lib/store";
import { AddToCart } from "./AddToCart";
import { ProductCard } from "./ProductCard";
import { ProductPhoto } from "./ProductPhoto";
import { ProductReviews } from "./ProductReviews";

export function ProductDetail({ product }: { product: Product }) {
  const model = useAppStore((s) => s.model);
  const rating = useProductRatings()[product.id];
  const suggestion = suggestedQuantity(product, model);

  const related = PRODUCTS.filter(
    (other) => other.category === product.category && other.id !== product.id,
  ).slice(0, 3);

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav aria-label="Хлебные крошки" className="text-body-s text-cream-dim">
          <Link href="/market" className="transition-colors hover:text-cream-bright">
            Магазин материалов
          </Link>
          <span aria-hidden="true" className="px-2">
            /
          </span>
          <span className="text-cream">{categoryLabel(product.category)}</span>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
          {/* self-start keeps the photo its own height: stretched to match the
              spec sheet beside it, the panel would run on as empty surface
              under a 4:3 image. */}
          <div className="plate self-start overflow-hidden lg:sticky lg:top-24">
            <div className="aspect-[4/3]">
              <ProductPhoto id={product.id} alt={product.name} priority />
            </div>
          </div>

          <div>
            <p className="text-caption uppercase text-cream-dim">
              {product.brand} · {categoryLabel(product.category)}
            </p>
            <h1 className="font-display mt-2 text-h1 font-extrabold text-white">
              {product.name}
            </h1>
            {/* Оценка сразу под названием, до цены: сначала «стоит ли
                смотреть», потом «сколько стоит». */}
            {rating && (
              <RatingLine average={rating.average} count={rating.count} className="mt-3" />
            )}

            <p className="prose-measure mt-4 text-body-l text-cream-dim">
              {product.summary}
            </p>

            <div className="mt-8 flex items-end gap-3">
              <span className="font-display text-h1 font-extrabold tabular-nums text-accent">
                {formatRub(product.price)}
              </span>
              <span className="pb-1.5 text-body-l text-cream-dim">
                {priceUnitLabel(product.unit)}
              </span>
            </div>

            {suggestion && (
              <p className="plate mt-6 p-4 text-body-s text-soft">
                По вашей модели нужно{" "}
                <span className="font-bold tabular-nums text-cream-bright">
                  {suggestion.quantity} {marketUnitLabel(product.unit)}
                </span>{" "}
                — посчитано по геометрии: {suggestion.from}. Количество можно
                изменить.
              </p>
            )}

            <div className="mt-8">
              <AddToCart product={product} />
            </div>

            <table className="mt-10 w-full border-t border-[var(--plate-edge)] text-body-s">
              <caption className="pb-3 text-left text-caption font-medium uppercase text-cream-dim">
                Характеристики
              </caption>
              <tbody className="divide-y divide-[var(--plate-edge)]">
                {product.specs.map(([key, value]) => (
                  <tr key={key}>
                    <th
                      scope="row"
                      className="w-1/2 py-3 pr-4 text-left font-medium text-cream-dim"
                    >
                      {key}
                    </th>
                    <td className="py-3 text-cream">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ProductReviews productId={product.id} />

        {related.length > 0 && (
          <section className="mt-20 border-t border-[var(--plate-edge)] pt-10">
            <h2 className="font-display text-h2 font-medium text-cream-bright">
              Ещё в разделе «{categoryLabel(product.category)}»
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((other) => (
                <li key={other.id} className="h-full">
                  <ProductCard product={other} fitsModel={matchesModel(other, model)} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
