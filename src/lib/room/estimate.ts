import {
  productById,
  unitsForAreaM2,
  type MarketUnit,
  type Product,
} from "../marketplace";
import { roomSurfaces } from "./geometry";
import type { RoomModel, RoomSurface, SurfaceId } from "./types";

/**
 * Смета по комнате: сколько чего поверхности и сколько чего покупать.
 *
 * Это сознательно два разных списка, а не один. По поверхностям человек
 * проверяет замер — «пол 14,7, стена вторая 7,4». Покупает он не по
 * поверхностям: одного ведра краски хватает и на стены, и на потолок, и
 * строка «ведро» напротив каждой стены превратила бы одно ведро в четыре.
 * Поэтому площади складываются по товару ДО перевода в единицы — округление
 * вверх, выполненное четыре раза, всегда покупает лишнее.
 *
 * Запас на подрезку по той же причине не подмешан в площадь: обе цифры видны
 * отдельно, иначе через месяц десять процентов запаса окажутся ошибкой
 * замера, и никто уже не разберётся, где именно.
 */
export interface RoomEstimateLine {
  surface: RoomSurface;
  product: Product;
  /** Площадь поверхности за вычетом проёмов. */
  areaM2: number;
  /** Она же с запасом. */
  areaWithWasteM2: number;
}

/** Одна строка списка покупок: товар и всё, что им отделывается. */
export interface RoomPurchase {
  product: Product;
  /** Поверхности, на которые он идёт. */
  surfaces: RoomSurface[];
  areaM2: number;
  areaWithWasteM2: number;
  /**
   * Сколько единиц брать. null, если в паспорте товара нет расхода: врать
   * правдоподобным числом хуже, чем сказать, что расход надо уточнить.
   */
  quantity: number | null;
  unit: MarketUnit;
  pricePerUnit: number;
  total: number;
}

export interface RoomEstimate {
  lines: RoomEstimateLine[];
  purchases: RoomPurchase[];
  /** Поверхности, для которых материал ещё не выбран. */
  unfinished: RoomSurface[];
  floorM2: number;
  wallsM2: number;
  ceilingM2: number;
  openingsM2: number;
  total: number;
  /** Есть ли товары, по которым расход неизвестен. */
  hasUnknownRate: boolean;
}

export function withWaste(areaM2: number, wastePct: number): number {
  return areaM2 * (1 + wastePct / 100);
}

export function roomEstimate(model: RoomModel): RoomEstimate {
  const surfaces = roomSurfaces(model);
  const lines: RoomEstimateLine[] = [];
  const unfinished: RoomSurface[] = [];
  const byProduct = new Map<string, { product: Product; surfaces: RoomSurface[] }>();

  for (const surface of surfaces) {
    const productId = model.finishes[surface.id];
    const product = productId ? productById(productId) : undefined;
    if (!product) {
      unfinished.push(surface);
      continue;
    }

    lines.push({
      surface,
      product,
      areaM2: surface.netM2,
      areaWithWasteM2: withWaste(surface.netM2, model.wastePct),
    });

    const entry = byProduct.get(product.id);
    if (entry) entry.surfaces.push(surface);
    else byProduct.set(product.id, { product, surfaces: [surface] });
  }

  const purchases: RoomPurchase[] = [...byProduct.values()].map(
    ({ product, surfaces: covered }) => {
      const areaM2 = covered.reduce((sum, s) => sum + s.netM2, 0);
      const areaWithWasteM2 = withWaste(areaM2, model.wastePct);
      const quantity = unitsForAreaM2(product, areaWithWasteM2);
      return {
        product,
        surfaces: covered,
        areaM2,
        areaWithWasteM2,
        quantity,
        unit: product.unit,
        pricePerUnit: product.price,
        total: quantity === null ? 0 : Math.round(product.price * quantity),
      };
    },
  );

  const sumBy = (pick: (s: RoomSurface) => boolean) =>
    surfaces.filter(pick).reduce((sum, s) => sum + s.netM2, 0);

  return {
    lines,
    purchases,
    unfinished,
    floorM2: sumBy((s) => s.kind === "floor"),
    wallsM2: sumBy((s) => s.kind === "wall"),
    ceilingM2: sumBy((s) => s.kind === "ceiling"),
    openingsM2: surfaces.reduce((sum, s) => sum + s.openingsM2, 0),
    total: purchases.reduce((sum, p) => sum + p.total, 0),
    hasUnknownRate: purchases.some((p) => p.quantity === null),
  };
}

/**
 * Что положить в корзину, по товарам.
 *
 * Ровно те же числа, что показаны в списке покупок — иначе корзина спорила
 * бы со сметой, которую человек только что прочитал.
 */
export function roomCartAdditions(model: RoomModel): Record<string, number> {
  const additions: Record<string, number> = {};
  for (const purchase of roomEstimate(model).purchases) {
    if (purchase.quantity !== null && purchase.quantity > 0) {
      additions[purchase.product.id] = purchase.quantity;
    }
  }
  return additions;
}

/** Поверхности, у которых материал уже выбран. */
export function finishedSurfaceIds(model: RoomModel): SurfaceId[] {
  return roomSurfaces(model)
    .filter((s) => Boolean(model.finishes[s.id]))
    .map((s) => s.id);
}
