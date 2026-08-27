import { BRANDS_EN, CATEGORY_LABELS_EN, PRODUCTS_EN } from "./catalog-en";
import { DEFAULT_LOCALE, type Locale } from "./locale";
import {
  categoryLabel,
  marketUnitLabel,
  type CategoryId,
  type MarketUnit,
  type Product,
} from "@/lib/marketplace";

/**
 * Каталог на языке читателя.
 *
 * Русский текст берётся из самого каталога, английский — из наложения
 * `catalog-en.ts`. Если перевода нет, возвращается русский: добавленный
 * товар должен быть виден в обеих версиях, пусть и не переведённым. Молча
 * пропасть из английского каталога он не имеет права — этого никто не
 * заметит месяцами.
 */

export interface ProductText {
  name: string;
  summary: string;
  specs: [string, string][];
}

export function productText(product: Product, locale: Locale = DEFAULT_LOCALE): ProductText {
  if (locale === DEFAULT_LOCALE) {
    return { name: product.name, summary: product.summary, specs: product.specs };
  }
  const translated = PRODUCTS_EN[product.id];
  return translated ?? { name: product.name, summary: product.summary, specs: product.specs };
}

export function brandLabel(brand: string, locale: Locale = DEFAULT_LOCALE): string {
  // Латинские названия («BRAER», «Tarkett») в словаре не лежат: они читаются
  // одинаково на обоих языках, и вторая запись однажды разошлась бы с первой.
  return locale === DEFAULT_LOCALE ? brand : (BRANDS_EN[brand] ?? brand);
}

export function categoryText(id: CategoryId, locale: Locale = DEFAULT_LOCALE): string {
  return locale === DEFAULT_LOCALE ? categoryLabel(id) : CATEGORY_LABELS_EN[id];
}

/** Торговые единицы. Метры и штуки — те же, но пишутся по-своему. */
const UNIT_LABELS_EN: Record<MarketUnit, string> = {
  m2: "m²",
  pcs: "pcs",
  sheet: "sheet",
  roll: "roll",
  pack: "pack",
  bag: "bag",
  bucket: "tin",
  panel: "panel",
};

export function unitText(unit: MarketUnit, locale: Locale = DEFAULT_LOCALE): string {
  return locale === DEFAULT_LOCALE ? marketUnitLabel(unit) : UNIT_LABELS_EN[unit];
}

/** «780 ₽ за м²» / «780 ₽ per m²» — единица часть цены, а не сноска. */
export function priceUnitText(unit: MarketUnit, locale: Locale = DEFAULT_LOCALE): string {
  if (locale === DEFAULT_LOCALE) {
    return unit === "m2" ? "за м²" : `за ${marketUnitLabel(unit).replace(".", "")}`;
  }
  return `per ${UNIT_LABELS_EN[unit]}`;
}
