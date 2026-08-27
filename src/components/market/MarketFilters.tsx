"use client";

import { useState } from "react";
import { formatRub } from "@/lib/format";
import {
  BRANDS,
  CATEGORIES,
  PRICE_MAX,
  PRICE_MIN,
  type CategoryId,
} from "@/lib/marketplace";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { brandLabel, categoryText } from "@/lib/i18n/product-text";
import { PRODUCTS } from "@/lib/marketplace";
import { useProductRatings, type ProductRating } from "@/lib/product-ratings";

/**
 * Category, brand and price filters.
 *
 * The price control is logarithmic: the catalogue runs from a 24 ₽ brick to a
 * 27 900 ₽ door, and on a linear slider every material below a thousand
 * roubles — most of the catalogue — would be crushed into the first two per
 * cent of the track.
 */

export interface FilterState {
  categories: CategoryId[];
  brands: string[];
  maxPrice: number;
  onlyForModel: boolean;
  /**
   * Полоса оценки: 5, 4, 3, 2, 1 — округлённая средняя, или 0 для товаров
   * без единого отзыва. null — не фильтруем.
   */
  ratingBand: number | null;
}

export const INITIAL_FILTER: FilterState = {
  categories: [],
  brands: [],
  maxPrice: PRICE_MAX,
  onlyForModel: false,
  ratingBand: null,
};

/**
 * Полоса, в которую попадает товар по своей средней оценке.
 *
 * Полосы **не накопительные**: «4 ★» это 3,5–4,49, а не «четыре и выше».
 * Накопительные («от 4 и выше») привычнее по маркетплейсам, но они врут
 * глазу: столбик у двойки включал бы в себя весь каталог, и картинка
 * показывала бы не разброс оценок, а порядок сортировки. Здесь столбики —
 * это настоящая форма каталога, и её видно до всякого клика.
 *
 * 0 — товар без отзывов. Отдельная полоса, а не «единица»: «никто не
 * оценил» и «оценили на единицу» — разные новости, и складывать их нельзя.
 */
export function ratingBandOf(rating: ProductRating | undefined): number {
  if (!rating || rating.count === 0) return 0;
  return Math.max(1, Math.min(5, Math.round(rating.average)));
}

/** Brands shown before the list has to be asked for. */
const BRANDS_SHOWN = 6;

const STEPS = 100;
const RATIO = Math.log(PRICE_MAX / PRICE_MIN);

export function priceToSlider(price: number): number {
  return Math.round((Math.log(price / PRICE_MIN) / RATIO) * STEPS);
}

export function sliderToPrice(value: number): number {
  return Math.round(PRICE_MIN * Math.exp((value / STEPS) * RATIO));
}

interface MarketFiltersProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
  /** Shown only when there is a model to match against. */
  hasModel: boolean;
  resultCount: number;
  locale?: Locale;
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function MarketFilters({
  value,
  onChange,
  hasModel,
  resultCount,
  locale = DEFAULT_LOCALE,
}: MarketFiltersProps) {
  const t = getDictionary(locale).market;
  const [allBrands, setAllBrands] = useState(false);
  // Fourteen brands is four rows of chips on a phone — more height than the
  // catalogue itself gets above the fold. Any brand already picked stays
  // visible, so collapsing never hides an active filter.
  const brands = allBrands
    ? BRANDS
    : Array.from(
        new Set([
          ...BRANDS.slice(0, BRANDS_SHOWN),
          ...BRANDS.filter((b) => value.brands.includes(b)),
        ]),
      );

  const isDefault =
    !value.categories.length &&
    !value.brands.length &&
    value.maxPrice >= PRICE_MAX &&
    !value.onlyForModel &&
    value.ratingBand === null;

  return (
    <section
      aria-label={t.filtersLabel}
      className="plate p-5 sm:p-6"
    >
      <FilterGroup label={t.category}>
        {CATEGORIES.map((category) => (
          <Chip
            key={category.id}
            active={value.categories.includes(category.id)}
            onClick={() =>
              onChange({ ...value, categories: toggle(value.categories, category.id) })
            }
          >
            {categoryText(category.id, locale)}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label={t.brand}>
        {brands.map((brand) => (
          <Chip
            key={brand}
            active={value.brands.includes(brand)}
            onClick={() => onChange({ ...value, brands: toggle(value.brands, brand) })}
          >
            {brandLabel(brand, locale)}
          </Chip>
        ))}
        {brands.length < BRANDS.length && (
          <button
            type="button"
            onClick={() => setAllBrands(true)}
            className="rounded-full px-3.5 py-1.5 text-body-s font-medium text-cream underline underline-offset-2 transition-colors hover:text-cream-bright"
          >
            {t.more(BRANDS.length - brands.length)}
          </button>
        )}
      </FilterGroup>

      <RatingFilter value={value} onChange={onChange} locale={locale} />

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
        <label className="flex min-w-64 flex-1 flex-col gap-2">
          <span className="text-caption font-medium uppercase text-cream-dim">
            {t.priceUpTo(formatRub(value.maxPrice))}
          </span>
          <input
            type="range"
            min={0}
            max={STEPS}
            value={priceToSlider(value.maxPrice)}
            onChange={(e) =>
              onChange({ ...value, maxPrice: sliderToPrice(Number(e.target.value)) })
            }
            className="market-range"
          />
        </label>

        {hasModel && (
          <Chip
            active={value.onlyForModel}
            onClick={() => onChange({ ...value, onlyForModel: !value.onlyForModel })}
          >
            {t.onlyMyModel}
          </Chip>
        )}

        <p role="status" className="text-body-s text-cream-dim">
          {t.found} <span className="tabular-nums text-cream">{resultCount}</span>
        </p>

        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange(INITIAL_FILTER)}
            className="text-body-s font-medium text-cream underline underline-offset-2 transition-colors hover:text-cream-bright"
          >
            {t.reset}
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * Оценка — гистограммой, а не строкой чипов.
 *
 * Чипы «5 ★ / 4 ★ / 3 ★» сказали бы только, что фильтр есть. Столбики
 * говорят больше: сколько товаров в каждой полосе и какой формы каталог —
 * и отвечают на «а есть ли там вообще что-то ниже четвёрки» раньше, чем
 * человек нажмёт.
 *
 * Оценки приезжают после отрисовки (каталог статический), поэтому пока их
 * нет, группы нет вовсе. Пустая рамка с нулями сдвигала бы фильтры под
 * руками у читающего.
 */
function RatingFilter({
  value,
  onChange,
  locale,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  locale: Locale;
}) {
  const t = getDictionary(locale).market;
  const ratings = useProductRatings();

  const bands = [5, 4, 3, 2, 1, 0];
  const counts = new Map<number, number>(bands.map((b) => [b, 0]));
  for (const product of PRODUCTS) {
    const band = ratingBandOf(ratings[product.id]);
    counts.set(band, (counts.get(band) ?? 0) + 1);
  }

  const shown = bands.filter((b) => (counts.get(b) ?? 0) > 0);
  // Одна полоса на весь каталог — фильтровать не по чему.
  if (shown.length < 2) return null;

  const max = Math.max(...shown.map((b) => counts.get(b) ?? 0));

  // Сводка: средняя по каталогу, взвешенная по числу отзывов, — то же
  // число, что человек увидел бы, сложив все отзывы. Простое среднее
  // средних дало бы товару с одним отзывом тот же вес, что товару с
  // девятью.
  const all = PRODUCTS.map((p) => ratings[p.id]).filter(Boolean) as ProductRating[];
  const reviews = all.reduce((sum, r) => sum + r.count, 0);
  const average = reviews
    ? (all.reduce((sum, r) => sum + r.average * r.count, 0) / reviews).toFixed(1)
    : null;

  return (
    <FilterGroup label={t.rating}>
      <div className="w-full max-w-md">
        {average && (
          <p className="mb-2 text-caption text-cream-dim">
            {t.ratingSummary(average, reviews)}
          </p>
        )}

        <div className="space-y-1">
          {shown.map((band) => {
            const count = counts.get(band) ?? 0;
            const active = value.ratingBand === band;
            return (
              <button
                key={band}
                type="button"
                aria-pressed={active}
                // Повторное нажатие снимает фильтр: у одиночного выбора
                // иначе нет выхода, кроме кнопки «Сбросить» где-то внизу.
                onClick={() => onChange({ ...value, ratingBand: active ? null : band })}
                // Выбранная полоса подсвечивается плашкой и золотой
                // волосяной рамкой — тем же языком, что и чипы категорий
                // выше: без рамки одна подложка на тёмном фоне читается как
                // наведение мышью, а не как выбор.
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left transition-colors ${
                  active
                    ? "bg-[var(--blue-lift)] ring-1 ring-[var(--accent-line)]"
                    : "hover:bg-[var(--blue-lift)]"
                }`}
              >
                <span
                  // У полосы «без отзывов» звёзд нет по определению, и
                  // рисовать «0 ★» нельзя: ноль звёзд читается как «плохо»,
                  // хотя это «никто не оценил».
                  title={band === 0 ? t.ratingNone : undefined}
                  className={`w-9 shrink-0 text-caption font-bold tabular-nums ${
                    band === 0 ? "text-cream-dim" : "text-accent"
                  }`}
                >
                  {band === 0 ? "—" : t.ratingBand(band)}
                </span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--plate-edge)]">
                  <span
                    aria-hidden="true"
                    className={`block h-full rounded-full ${band === 0 ? "bg-dim" : "bg-accent"}`}
                    style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-caption tabular-nums text-cream-dim">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </FilterGroup>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 first:mt-0">
      <h2 className="text-caption font-medium uppercase text-cream-dim">{label}</h2>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-body-s font-medium transition-colors ${
        active
          ? "border-accent bg-accent text-deep"
          : "border-[var(--plate-edge)] text-cream-dim hover:border-cream-dim hover:text-cream-bright"
      }`}
    >
      {children}
    </button>
  );
}
