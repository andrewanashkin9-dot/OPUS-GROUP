"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { suggestedQuantity, type Product } from "@/lib/marketplace";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { unitText } from "@/lib/i18n/product-text";
import { quantityStep } from "@/lib/quantity-step";
import { useAppStore } from "@/lib/store";

/**
 * Adds a product to the cart the configurator already fills. There is one
 * basket for the whole build, so this writes into the same store the bill of
 * materials reads from.
 */

interface AddToCartProps {
  product: Product;
  compact?: boolean;
  locale?: Locale;
}

export function AddToCart({ product, compact = false, locale = DEFAULT_LOCALE }: AddToCartProps) {
  const t = getDictionary(locale).market;
  const model = useAppStore((s) => s.model);
  const addMarketItem = useAppStore((s) => s.addMarketItem);
  const inCart = useAppStore((s) => s.marketItems[product.id]);

  // The saved project is replayed into the store after mount, so on the first
  // render there is no model and no suggestion yet. Seeding state from the
  // suggestion would therefore freeze it at 1 while the page went on to say
  // "нужно 144 м²" — the field and the sentence next to it disagreeing.
  // Holding only the reader's own override keeps the default following the
  // model, with no effect and no remount to resynchronise them.
  const suggestion = suggestedQuantity(product, model);
  const [override, setOverride] = useState<number | null>(null);
  const quantity = override ?? suggestion?.quantity ?? 1;
  const setQuantity = (next: number) => setOverride(Math.max(1, next));

  if (compact) {
    return (
      <button
        type="button"
        // Quick-add takes the quantity the model implies, when it knows one:
        // one brick is never the answer to a facade.
        onClick={() => addMarketItem(product.id, quantity)}
        className="relative z-10 shrink-0 rounded-full border border-[var(--plate-edge)] px-3 py-1.5 text-body-s font-medium text-cream transition-colors hover:border-cream-dim hover:text-cream-bright"
      >
        {inCart ? t.inEstimateShort(String(inCart)) : t.addToEstimate}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t.decrease}
          onClick={() => setQuantity(quantity - quantityStep(quantity))}
          className="h-10 w-10 rounded-full border border-[var(--plate-edge)] text-cream-dim transition-colors hover:border-cream-dim hover:text-cream-bright"
        >
          −
        </button>
        <label className="flex items-center gap-2">
          <span className="sr-only">{t.quantity}</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 1)}
            className="w-20 rounded-lg border border-[var(--plate-edge)] bg-surface px-3 py-2 text-center text-body tabular-nums text-cream-bright"
          />
        </label>
        <button
          type="button"
          aria-label={t.increase}
          onClick={() => setQuantity(quantity + quantityStep(quantity))}
          className="h-10 w-10 rounded-full border border-[var(--plate-edge)] text-cream-dim transition-colors hover:border-cream-dim hover:text-cream-bright"
        >
          +
        </button>
        <span className="text-body-s text-cream-dim">
          {unitText(product.unit, locale)}
        </span>
      </div>

      <Button onClick={() => addMarketItem(product.id, quantity)}>
        {t.addToEstimate}
      </Button>

      {inCart ? (
        <span role="status" className="text-body-s text-cream-dim">
          {t.alreadyIn(`${inCart} ${unitText(product.unit, locale)}`)}
        </span>
      ) : null}
    </div>
  );
}
