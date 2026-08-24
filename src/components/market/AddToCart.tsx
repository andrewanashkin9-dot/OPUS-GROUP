"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { marketUnitLabel, type Product } from "@/lib/marketplace";
import { useAppStore } from "@/lib/store";

/**
 * Adds a product to the cart the configurator already fills. There is one
 * basket for the whole build, so this writes into the same store the bill of
 * materials reads from.
 */

interface AddToCartProps {
  product: Product;
  /** Quantity the model implies, when it can answer that. */
  suggested?: number;
  compact?: boolean;
}

export function AddToCart({ product, suggested, compact = false }: AddToCartProps) {
  const addMarketItem = useAppStore((s) => s.addMarketItem);
  const inCart = useAppStore((s) => s.marketItems[product.id]);
  const [quantity, setQuantity] = useState(suggested ?? 1);

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => addMarketItem(product.id, 1)}
        className="relative z-10 shrink-0 rounded-full border border-line px-3 py-1.5 text-body-s font-medium text-cream transition-colors hover:border-cream-dim hover:text-cream-bright"
      >
        {inCart ? `В смете · ${inCart}` : "В смету"}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Уменьшить количество"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          className="h-10 w-10 rounded-full border border-line text-cream-dim transition-colors hover:border-cream-dim hover:text-cream-bright"
        >
          −
        </button>
        <label className="flex items-center gap-2">
          <span className="sr-only">Количество</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 rounded-lg border border-line bg-surface px-3 py-2 text-center text-body tabular-nums text-cream-bright"
          />
        </label>
        <button
          type="button"
          aria-label="Увеличить количество"
          onClick={() => setQuantity((q) => q + 1)}
          className="h-10 w-10 rounded-full border border-line text-cream-dim transition-colors hover:border-cream-dim hover:text-cream-bright"
        >
          +
        </button>
        <span className="text-body-s text-cream-dim">
          {marketUnitLabel(product.unit)}
        </span>
      </div>

      <Button onClick={() => addMarketItem(product.id, quantity)}>
        Добавить в смету
      </Button>

      {inCart ? (
        <span role="status" className="text-body-s text-cream-dim">
          Уже в смете: {inCart} {marketUnitLabel(product.unit)}
        </span>
      ) : null}
    </div>
  );
}
