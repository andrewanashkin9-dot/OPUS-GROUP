"use client";

import { formatRub } from "@/lib/format";
import {
  BRANDS,
  CATEGORIES,
  PRICE_MAX,
  PRICE_MIN,
  type CategoryId,
} from "@/lib/marketplace";

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
}

export const INITIAL_FILTER: FilterState = {
  categories: [],
  brands: [],
  maxPrice: PRICE_MAX,
  onlyForModel: false,
};

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
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function MarketFilters({
  value,
  onChange,
  hasModel,
  resultCount,
}: MarketFiltersProps) {
  const isDefault =
    !value.categories.length &&
    !value.brands.length &&
    value.maxPrice >= PRICE_MAX &&
    !value.onlyForModel;

  return (
    <section
      aria-label="Фильтры каталога"
      className="surface-1 rounded-2xl border border-line p-5 sm:p-6"
    >
      <FilterGroup label="Категория">
        {CATEGORIES.map((category) => (
          <Chip
            key={category.id}
            active={value.categories.includes(category.id)}
            onClick={() =>
              onChange({ ...value, categories: toggle(value.categories, category.id) })
            }
          >
            {category.label}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Производитель">
        {BRANDS.map((brand) => (
          <Chip
            key={brand}
            active={value.brands.includes(brand)}
            onClick={() => onChange({ ...value, brands: toggle(value.brands, brand) })}
          >
            {brand}
          </Chip>
        ))}
      </FilterGroup>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
        <label className="flex min-w-64 flex-1 flex-col gap-2">
          <span className="text-caption font-medium uppercase text-cream-dim">
            Цена — до {formatRub(value.maxPrice)}
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
            Только для моей модели
          </Chip>
        )}

        <p role="status" className="text-body-s text-cream-dim">
          Найдено: <span className="tabular-nums text-cream">{resultCount}</span>
        </p>

        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange(INITIAL_FILTER)}
            className="text-body-s font-medium text-cream underline underline-offset-2 transition-colors hover:text-cream-bright"
          >
            Сбросить
          </button>
        )}
      </div>
    </section>
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
          ? "border-cream-bright bg-cream text-bg"
          : "border-line text-cream-dim hover:border-cream-dim hover:text-cream-bright"
      }`}
    >
      {children}
    </button>
  );
}
