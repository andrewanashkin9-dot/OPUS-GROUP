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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--plate-edge)] bg-[rgba(7,18,41,0.72)] px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-4 min-w-0">
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="На главную">
          <Logo className="h-7 w-7 text-accent" />
        </Link>
        <span className="truncate text-body-s font-medium text-dim">
          {model?.name ?? "Новый проект"}
        </span>
        {model && (
          <button
            type="button"
            onClick={resetProject}
            className="hidden shrink-0 text-body-s font-medium text-dim underline underline-offset-2 transition-colors hover:text-white md:inline"
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
              ? "hidden items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-caption font-bold uppercase text-deep sm:inline-flex"
              : "hidden items-center gap-2 rounded-full border border-[var(--plate-edge)] px-3 py-1.5 text-caption font-medium uppercase text-dim transition-colors hover:border-[var(--plate-edge-hi)] hover:text-white sm:inline-flex"
          }
        >
          {tier === "free" && (
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--dim)" }}
              aria-hidden="true"
            />
          )}
          {tier === "pro" ? "Подписка активна" : "Тариф: Бесплатно"}
        </button>
        <div className="text-right">
          <p className="text-caption uppercase text-dim">Смета</p>
          <p className="font-body text-ui font-bold tabular-nums text-accent">
            {formatRub(total)}
          </p>
        </div>
        <Link
          href="/cart"
          className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-body-s font-bold text-deep shadow-[var(--lift-1)] transition-[filter] hover:brightness-108"
        >
          В корзину
        </Link>
      </div>
    </header>
  );
}
