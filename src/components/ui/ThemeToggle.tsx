"use client";

import { useSyncExternalStore } from "react";
import {
  getServerTheme,
  getTheme,
  setTheme,
  subscribeTheme,
  type Theme,
} from "@/lib/theme";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";

/**
 * Switches the sheet between blue paper and black.
 *
 * Reads through useSyncExternalStore rather than useState: the live value is
 * an attribute the inline script already put on <html>, so the server and the
 * hydrating client both read the default and the real value arrives as an
 * ordinary store update — no mismatch, and no flash of the wrong sheet.
 */

export function ThemeToggle({
  className = "",
  locale = DEFAULT_LOCALE,
}: {
  className?: string;
  locale?: Locale;
}) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const next: Theme = theme === "blue" ? "black" : "blue";

  // Названия тем — тоже текст страницы: на английской версии «Чёрная
  // калька» в подсказке читается как недоделанный перевод, а не как
  // особенность оформления.
  const t = getDictionary(locale).theme;
  const label = t.switchTo(next === "blue" ? t.blue : t.black);

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      // The control is a switch between two named surfaces, so the label says
      // which one it moves to rather than leaving a bare icon to be guessed at.
      aria-label={label}
      title={next === "blue" ? t.blue : t.black}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--plate-edge)] text-white transition-colors hover:border-[var(--plate-edge-hi)] hover:text-accent ${className}`}
    >
      <span className="sr-only">{label}</span>
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
