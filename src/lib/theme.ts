/**
 * Which sheet the drawing is on: blue paper or black.
 *
 * The choice lives on <html data-theme> and in localStorage, and it is applied
 * by an inline script before first paint (see layout.tsx) — not by React. That
 * ordering is the whole trick: read it during render and the server would say
 * "blue" while the browser says "black", which is a hydration mismatch and, on
 * a theme, a visible flash of the wrong colour.
 *
 * So React never owns the value. It subscribes to it.
 */

export type Theme = "blue" | "black";

/** Whatever was deployed first is what a first-time visitor gets. */
export const DEFAULT_THEME: Theme = "blue";

export const THEME_STORAGE_KEY = "opus-theme";

const listeners = new Set<() => void>();

export function getTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const value = document.documentElement.dataset.theme;
  return value === "black" || value === "blue" ? value : DEFAULT_THEME;
}

/** The value both the server and the hydrating client agree on. */
export function getServerTheme(): Theme {
  return DEFAULT_THEME;
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // A locked or full store costs the choice its persistence, never the page.
  }
  for (const listener of listeners) listener();
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Runs before anything paints. Kept as a string because it has to be inlined
 * into the document head — a module would arrive a network hop too late, and
 * the reader would see the default theme first.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});document.documentElement.dataset.theme=(t==="black"||t==="blue")?t:${JSON.stringify(
  DEFAULT_THEME,
)};}catch(e){document.documentElement.dataset.theme=${JSON.stringify(
  DEFAULT_THEME,
)};}})();`;
