"use client";

import { useStoreHydration } from "@/lib/store";

/**
 * Restores the saved project (model, tier, quantities) once on mount, so the
 * cart and services pages still know the user's house after a reload or when
 * opened directly from a link. Renders nothing.
 */
export function StoreHydrator() {
  useStoreHydration();
  return null;
}
