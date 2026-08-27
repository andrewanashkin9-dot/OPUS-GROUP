"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Рейтинги товаров в браузере.
 *
 * Каталог и страницы товаров собираются заранее и отдаются с CDN — это самое
 * ценное, что есть у магазина, и терять это ради двух цифр в карточке
 * нельзя. Поэтому оценки не приезжают вместе со страницей, а подгружаются
 * после отрисовки: разметка остаётся статической, а рейтинг появляется
 * следом.
 *
 * Хранилище — модуль, а не состояние компонента: карточек на странице
 * тридцать семь, и каждая, спрашивая сама за себя, устроила бы тридцать семь
 * одинаковых запросов. Здесь запрос один на все.
 */

export interface ProductRating {
  productId: string;
  average: number;
  count: number;
}

type Ratings = Record<string, ProductRating>;

const EMPTY: Ratings = {};

let state: Ratings = EMPTY;
const listeners = new Set<() => void>();
let loaded = false;
let inFlight: Promise<void> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Ratings {
  return state;
}

/**
 * Снимок для сервера — всегда **один и тот же объект**. Новый на каждый
 * вызов React принял бы за бесконечно меняющееся состояние и ушёл в цикл.
 */
function getServerSnapshot(): Ratings {
  return EMPTY;
}

function load(): Promise<void> {
  if (loaded) return Promise.resolve();
  inFlight ??= fetch("/api/products/ratings", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { ratings: [] }))
    .then((data: { ratings?: ProductRating[] }) => {
      const next: Ratings = {};
      for (const item of data.ratings ?? []) next[item.productId] = item;
      state = next;
      loaded = true;
      for (const listener of listeners) listener();
    })
    .catch(() => {
      // Сеть отвалилась — карточки останутся без оценок. Это хуже, чем с
      // ними, но лучше, чем пустой каталог: товары и цены на месте.
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Рейтинги всех товаров. Загружаются один раз на страницу. */
export function useProductRatings(): Ratings {
  const ratings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    void load();
  }, []);
  return ratings;
}
