"use client";

import { ROOM_STEPS, type RoomStep } from "@/lib/store";

interface StepNavProps {
  step: RoomStep;
  onStep: (step: RoomStep) => void;
  /** Why the reader cannot move on yet, if they cannot. */
  blockedReason: string | null;
}

/**
 * Four steps, always visible, always clickable backwards.
 *
 * A wizard that hides where it is going makes people guess how much is left;
 * one that locks the steps behind it makes them start over to fix a typo.
 */
export function StepNav({ step, onStep, blockedReason }: StepNavProps) {
  const current = ROOM_STEPS.findIndex((s) => s.id === step);

  return (
    <nav aria-label="Шаги" className="flex items-center gap-1">
      {ROOM_STEPS.map((entry, i) => {
        const active = entry.id === step;
        const done = i < current;
        // Forward moves are blocked while the room does not add up; going
        // back never is, because going back is how you fix it.
        const blocked = i > current && blockedReason !== null;
        return (
          <button
            key={entry.id}
            type="button"
            disabled={blocked}
            title={blocked ? blockedReason : undefined}
            onClick={() => onStep(entry.id)}
            aria-current={active ? "step" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-caption font-medium uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              active
                ? "bg-accent text-deep"
                : done
                  ? "text-white hover:bg-[var(--plate-quiet)]"
                  : "text-dim hover:bg-[var(--plate-quiet)] hover:text-white"
            }`}
          >
            <span className="tabular-nums opacity-60">{i + 1}</span>
            <span className="ml-1.5">{entry.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
