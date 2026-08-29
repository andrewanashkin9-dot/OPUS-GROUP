"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { formatRub } from "@/lib/format";
import { useAppStore, useRoomEstimate } from "@/lib/store";
import { remainingLabel } from "@/lib/usage";

export function RoomTopBar() {
  const room = useAppStore((s) => s.room);
  const usage = useAppStore((s) => s.usage);
  const resetRoom = useAppStore((s) => s.resetRoom);
  const estimate = useRoomEstimate();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--plate-edge)] bg-[var(--bar)] px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="На главную">
          <Logo className="h-8 w-8 text-brand-cream" />
        </Link>
        <span className="truncate text-body-s font-medium text-dim">
          {room?.name ?? "Комната"}
        </span>
        {room && (
          <button
            type="button"
            onClick={() => void resetRoom()}
            // Видна на любой ширине. Спрятанная под md, она оставляла телефон
            // без единого пути назад к загрузке фотографий: конструктор
            // восстанавливает сохранённый проект, и экран загрузки больше
            // не показывался никогда.
            className="shrink-0 text-body-s font-medium text-dim underline underline-offset-2 transition-colors hover:text-white"
          >
            Начать заново
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        {usage && usage.limit !== null && (
          <span className="hidden text-caption font-medium uppercase text-dim lg:inline">
            {remainingLabel(usage)}
          </span>
        )}
        <ThemeToggle />
        <div className="text-right">
          <p className="text-caption uppercase text-dim">Материалы</p>
          <p className="font-body text-ui font-bold tabular-nums text-accent">
            {formatRub(estimate?.total ?? 0)}
          </p>
        </div>
        <Link
          href="/cart"
          className="inline-flex shrink-0 items-center rounded-full bg-accent px-4 py-2 text-body-s font-bold text-deep shadow-[var(--lift-1)] transition-[filter] hover:brightness-108"
        >
          В смету
        </Link>
      </div>
    </header>
  );
}
