import catalog from "./marketplace-catalog.json";
import type { NodeKind, SceneModel } from "./3d/types";

/**
 * The materials market: everything the configurator does not put in the
 * estimate by itself.
 *
 * The catalogue lives in marketplace-catalog.json rather than in this file
 * because tools/generate-material-photos.mjs reads the same list to render
 * one catalogue photograph per product. Two copies of the list would drift
 * the moment a product was added, and the drift would show up as a missing
 * image rather than as a type error.
 */

export type CategoryId =
  | "roof"
  | "facade"
  | "insulation"
  | "waterproofing"
  | "fence"
  | "foundation"
  | "openings";

/**
 * Trade units. Deliberately separate from the 3D model's Unit: the model
 * measures geometry (m², m, pcs), a merchant sells packaging. Merging them
 * would put "рулон" into surfaces that are measured in metres.
 */
export type MarketUnit =
  | "m2"
  | "pcs"
  | "sheet"
  | "roll"
  | "pack"
  | "bag"
  | "panel";

export interface Category {
  id: CategoryId;
  label: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: CategoryId;
  /** Which part of the house this covers, when it maps onto one. */
  appliesTo?: NodeKind;
  price: number;
  unit: MarketUnit;
  summary: string;
  /** Spec sheet rows, in the order they should be read. */
  specs: [string, string][];
  photo: { kind: string; tint: string };
}

interface Catalog {
  categories: Category[];
  products: Product[];
}

// The JSON is authored alongside these types and validated by the photo
// generator, which fails loudly on an unknown material.
const { categories, products } = catalog as unknown as Catalog;

export const CATEGORIES = categories;
export const PRODUCTS = products;

export const BRANDS: string[] = Array.from(
  new Set(PRODUCTS.map((p) => p.brand)),
).sort((a, b) => a.localeCompare(b, "ru"));

export const PRICE_MIN = Math.min(...PRODUCTS.map((p) => p.price));
export const PRICE_MAX = Math.max(...PRODUCTS.map((p) => p.price));

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function categoryLabel(id: CategoryId): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

const UNIT_LABELS: Record<MarketUnit, string> = {
  m2: "м²",
  pcs: "шт",
  sheet: "лист",
  roll: "рулон",
  pack: "упак.",
  bag: "мешок",
  panel: "панель",
};

export function marketUnitLabel(unit: MarketUnit): string {
  return UNIT_LABELS[unit];
}

/** "1 180 ₽ за мешок" — the unit is part of the price, never a footnote. */
export function priceUnitLabel(unit: MarketUnit): string {
  return unit === "m2" ? "за м²" : `за ${UNIT_LABELS[unit].replace(".", "")}`;
}

export interface ProductFilter {
  categories: CategoryId[];
  brands: string[];
  /** Inclusive ceiling. Undefined means the whole range. */
  maxPrice?: number;
}

export function filterProducts(
  filter: ProductFilter,
  all: Product[] = PRODUCTS,
): Product[] {
  return all.filter((product) => {
    if (filter.categories.length && !filter.categories.includes(product.category)) {
      return false;
    }
    if (filter.brands.length && !filter.brands.includes(product.brand)) {
      return false;
    }
    if (filter.maxPrice !== undefined && product.price > filter.maxPrice) {
      return false;
    }
    return true;
  });
}

/**
 * The responsive set for one product photograph.
 *
 * Rendered at 2x and downsampled, so the 1x file is a real resample rather
 * than the same drawing at half the size. WebP first, JPEG for anything that
 * cannot read it — no browser gets both.
 */
export function photoSources(id: string) {
  const base = `/assets/materials/${id}`;
  return {
    webp: `${base}.webp 1x, ${base}@2x.webp 2x`,
    jpeg: `${base}.jpg 1x, ${base}@2x.jpg 2x`,
    fallback: `${base}.jpg`,
  };
}

/**
 * How much of this product the reader's own model needs.
 *
 * The point of the market sitting next to the configurator: a product that
 * covers a surface the model already measured does not have to be counted by
 * hand. Only offered where the model actually answers the question — a roll
 * of membrane or a bag of mortar depends on a build-up the model does not
 * describe, so those are left to the reader.
 */
export function suggestedQuantity(
  product: Product,
  model: SceneModel | null,
): { quantity: number; from: string } | null {
  if (!model || !product.appliesTo) return null;

  const nodes = model.nodes.filter((n) => n.kind === product.appliesTo);
  if (!nodes.length) return null;

  const total = nodes.reduce((sum, n) => sum + n.quantity, 0);
  const measure = nodes[0].unit;
  const from = nodes.length > 1 ? `${nodes.length} поверхности` : nodes[0].label;
  const rate = (pattern: RegExp) => {
    for (const [, value] of product.specs) {
      const found = value.match(pattern);
      if (found) {
        const n = Number(found[1].replace(",", "."));
        if (n > 0) return n;
      }
    }
    return null;
  };

  // Counted things map straight across: four windows in the model are four
  // windows to buy.
  if (measure === "pcs" && product.unit === "pcs") {
    return { quantity: Math.round(total), from };
  }

  // A surface the model measured in square metres.
  if (measure === "m2") {
    if (product.unit === "m2") return { quantity: Math.ceil(total), from };

    // Rates come out of the spec sheet rather than out of a table here, so
    // the arithmetic and the datasheet can never disagree.
    const perM2 = rate(/(\d+(?:[.,]\d+)?)\s*шт\/м²/);
    if (perM2) return { quantity: Math.ceil(total * perM2), from };

    const covers = rate(/(\d+(?:[.,]\d+)?)\s*м²\s*(?:на|\/)/);
    if (covers) return { quantity: Math.ceil(total / covers), from };
    return null;
  }

  // A run the model measured in metres — a fence.
  if (measure === "m") {
    const perMetre = rate(/(\d+(?:[.,]\d+)?)\s*шт\s*на\s*1\s*м/);
    if (perMetre) return { quantity: Math.ceil(total * perMetre), from };
    return null;
  }

  return null;
}

// The whole-model kinds a product can be matched against, for the "подходит
// вашей модели" marker on the cards.
export function matchesModel(product: Product, model: SceneModel | null): boolean {
  if (!model || !product.appliesTo) return false;
  return model.nodes.some((n) => n.kind === product.appliesTo);
}
