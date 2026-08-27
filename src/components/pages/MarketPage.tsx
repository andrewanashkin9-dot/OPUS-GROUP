"use client";

import { useMemo, useState } from "react";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import {
  INITIAL_FILTER,
  MarketFilters,
  ratingBandOf,
  type FilterState,
} from "@/components/market/MarketFilters";
import { ProductCard } from "@/components/market/ProductCard";
import { Reveal } from "@/components/ui/Reveal";
import { filterProducts, matchesModel, PRODUCTS } from "@/lib/marketplace";
import { useAppStore } from "@/lib/store";
import { useProductRatings } from "@/lib/product-ratings";
import { LocaleHtmlLang } from "@/components/LocaleHtmlLang";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";

export function MarketPage({ locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
  const t = getDictionary(locale).market;
  const model = useAppStore((s) => s.model);
  const ratings = useProductRatings();
  const [filter, setFilter] = useState<FilterState>(INITIAL_FILTER);

  const products = useMemo(() => {
    const base = filterProducts(
      {
        categories: filter.categories,
        brands: filter.brands,
        maxPrice: filter.maxPrice,
      },
      PRODUCTS,
    );
    // Оценка фильтруется здесь, а не в filterProducts: та работает по
    // каталогу-файлу, а рейтинги живут в базе и приезжают отдельно. Тащить
    // их внутрь означало бы связать чистую функцию над файлом с сетью.
    const rated =
      filter.ratingBand === null
        ? base
        : base.filter((product) => ratingBandOf(ratings[product.id]) === filter.ratingBand);

    if (!filter.onlyForModel) return rated;
    return rated.filter((product) => matchesModel(product, model));
  }, [filter, model, ratings]);

  return (
    <>
      <LocaleHtmlLang locale={locale} />
      <NavBar locale={locale} />
      <main className="mx-auto min-h-[60vh] w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-h1 font-extrabold text-cream-bright">
          {t.title}
        </h1>
        <p className="prose-measure mt-4 text-body-l text-cream-dim">
          {model ? t.introWithModel : t.introPlain}
        </p>

        <div className="mt-10">
          <MarketFilters
            value={filter}
            onChange={setFilter}
            hasModel={Boolean(model)}
            resultCount={products.length}
            locale={locale}
          />
        </div>

        {products.length === 0 ? (
          <p className="mt-16 text-center text-body-l text-cream-dim">
            {t.nothing}
          </p>
        ) : (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product, i) => (
              <li key={product.id} className="h-full">
                <Reveal index={i} className="h-full">
                  <ProductCard
                    product={product}
                    fitsModel={matchesModel(product, model)}
                    priority={i < 3}
                    locale={locale}
                  />
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer locale={locale} />
    </>
  );
}
