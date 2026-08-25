"use client";

import { useSyncExternalStore } from "react";
import {
  getServerTheme,
  getTheme,
  setTheme,
  subscribeTheme,
  type Theme,
} from "@/lib/theme";

/**
 * Switches the sheet between blue paper and black.
 *
 * Reads through useSyncExternalStore rather than useState: the live value is
 * an attribute the inline script already put on <html>, so the server and the
 * hydrating client both read the default and the real value arrives as an
 * ordinary store update — no mismatch, and no flash of the wrong sheet.
 */

const LABELS: Record<Theme, string> = {
  blue: "Синяя калька",
  black: "Чёрная калька",
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const next: Theme = theme === "blue" ? "black" : "blue";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      // The control is a switch between two named surfaces, so the label says
      // which one it moves to rather than leaving a bare icon to be guessed at.
      aria-label={`Переключить на: ${LABELS[next]}`}
      title={LABELS[next]}
      className={`flex h-10 w-10 items-center justify-center rounded-full border border-[var(--plate-edge)] text-white transition-colors hover:border-[var(--plate-edge-hi)] hover:text-accent ${className}`}
    >
      <span className="sr-only">{`Переключить на: ${LABELS[next]}`}</span>
      {/* Two overlapping sheets: the front one filled in the theme's own
          surface, so the icon shows what you are switching to. */}
      <svg
        viewBox="0 0 20 20"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3.25" y="3.25" width="10" height="10" rx="1.5" />
        <rect
          x="6.75"
          y="6.75"
          width="10"
          height="10"
          rx="1.5"
          fill={theme === "blue" ? "#000000" : "#0e2a5c"}
        />
      </svg>
    </button>
  );
}
