"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { formatRub } from "@/lib/format";
import { useAppStore, useBom, useCartTotal } from "@/lib/store";

export function TopBar() {
  const model = useAppStore((s) => s.model);
  const tier = useAppStore((s) => s.tier);
  const setTier = useAppStore((s) => s.setTier);
  const resetProject = useAppStore((s) => s.resetProject);
  const bom = useBom();
  const total = useCartTotal(bom);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4 sm:px-6">
      <div className="flex items-center gap-4 min-w-0">
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="На главную">
          <Logo className="h-7 w-7 text-cream" />
        </Link>
        <span className="truncate text-body-s font-medium text-cream-dim">
          {model?.name ?? "Новый проект"}
        </span>
        {model && (
          <button
            type="button"
            onClick={resetProject}
            className="hidden shrink-0 text-body-s font-medium text-cream-dim underline underline-offset-2 transition-colors hover:text-cream-bright md:inline"
          >
            Другие фото
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        <button
          type="button"
          onClick={() => setTier(tier === "free" ? "pro" : "free")}
          className={
            tier === "pro"
              ? "ingot hidden items-center gap-2 rounded-full px-3 py-1.5 text-caption font-bold uppercase sm:inline-flex"
              : "hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-caption font-medium uppercase text-cream-dim transition-colors hover:border-cream-dim sm:inline-flex"
          }
        >
          {tier === "free" && (
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--cream-dim)" }}
              aria-hidden="true"
            />
          )}
          {tier === "pro" ? "Подписка активна" : "Тариф: Бесплатно"}
        </button>
        <div className="text-right">
          <p className="text-caption uppercase text-cream-dim">Смета</p>
          <p className="font-body text-ui font-bold tabular-nums text-cream-bright">
            {formatRub(total)}
          </p>
        </div>
        <Link
          href="/cart"
          className="inline-flex items-center rounded-full bg-cream px-4 py-2 text-body-s font-bold text-bg transition-colors hover:bg-cream-bright"
        >
          В корзину
        </Link>
      </div>
    </header>
  );
}
