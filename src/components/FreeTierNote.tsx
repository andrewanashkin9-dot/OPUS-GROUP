"use client";

import { useUsage } from "@/lib/store";
import { remainingLabel } from "@/lib/usage";

/**
 * How much of the free tier is left, on the screen where it starts mattering.
 *
 * Rendered on the client because the count lives behind the UsageLimit seam
 * and is read after mount; the two cards around it are static.
 */
export function FreeTierNote() {
  const usage = useUsage();
  if (!usage || usage.limit === null) return null;

  return (
    <p className="mt-10 text-center text-body-s text-dim">
      {remainingLabel(usage)} на свободном тарифе. Проекты общие: и дома, и
      комнаты считаются вместе.
    </p>
  );
}
