"use client";

import { useMemo, useState } from "react";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import {
  INITIAL_FILTER,
  MarketFilters,
  type FilterState,
} from "@/components/market/MarketFilters";
import { ProductCard } from "@/components/market/ProductCard";
import { Reveal } from "@/components/ui/Reveal";
import { filterProducts, matchesModel, PRODUCTS } from "@/lib/marketplace";
import { useAppStore } from "@/lib/store";

export default function MarketPage() {
  const model = useAppStore((s) => s.model);
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
    if (!filter.onlyForModel) return base;
    return base.filter((product) => matchesModel(product, model));
  }, [filter, model]);

  return (
    <>
      <NavBar />
      <main className="mx-auto min-h-[60vh] w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-h1 font-extrabold text-cream-bright">
          Магазин материалов
        </h1>
        <p className="prose-measure mt-4 text-body-l text-cream-dim">
          {model
            ? "Всё, что нужно докупить сверх сметы по модели: изоляция, крепёж, смеси. Позиции, которые подходят вашему дому, отмечены — количество подставится из его геометрии."
            : "Кровля, фасад, утепление и изоляция от поставщиков, с которыми работают наши бригады. Соберите модель дома — и количество подставится из его геометрии."}
        </p>

        <div className="mt-10">
          <MarketFilters
            value={filter}
            onChange={setFilter}
            hasModel={Boolean(model)}
            resultCount={products.length}
          />
        </div>

        {products.length === 0 ? (
          <p className="mt-16 text-center text-body-l text-cream-dim">
            По этим условиям ничего нет — снимите часть фильтров.
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
                  />
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
