"use client";

import { useId, useState } from "react";

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

/**
 * A metre field that lets you type.
 *
 * The store clamps to the allowed range, which is right for the model and
 * wrong for the keyboard: typing "1" into a field whose minimum is 1,5 would
 * snap to the minimum and make "12" unreachable. So the draft lives here as
 * text, and only a parseable number is committed — on blur, or on Enter.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit = "м",
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(() => format(value));
  const [seen, setSeen] = useState(value);

  // The value can change from outside the field — the stepper, a reset, a
  // restored project — and the draft has to follow it. Adjusted during
  // render against the last value seen, rather than in an effect: an effect
  // would paint the stale draft first and correct it a frame later.
  if (value !== seen) {
    setSeen(value);
    setDraft(format(value));
  }

  const commit = (text: string) => {
    const parsed = Number(text.replace(",", ".").trim());
    if (Number.isFinite(parsed)) onChange(parsed);
    else setDraft(format(value));
  };

  const nudge = (delta: number) => {
    onChange(Math.min(max, Math.max(min, round(value + delta))));
  };

  return (
    <div>
      <label
        htmlFor={id}
        className="text-caption font-medium uppercase tracking-wide text-dim"
      >
        {label}, {unit}
      </label>
      <div className="mt-1.5 flex items-stretch overflow-hidden rounded-xl border border-[var(--plate-edge)] bg-[var(--plate-quiet)] focus-within:border-[var(--plate-edge-hi)]">
        <button
          type="button"
          onClick={() => nudge(-step)}
          disabled={value <= min}
          aria-label={`${label}: меньше`}
          className="w-8 shrink-0 text-ui font-bold text-dim transition-colors hover:text-white disabled:opacity-30"
        >
          −
        </button>
        <div className="flex min-w-0 flex-1 py-2.5">
          <input
            id={id}
            value={draft}
            inputMode="decimal"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="w-full min-w-0 bg-transparent text-center font-body text-ui font-bold tabular-nums text-white outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => nudge(step)}
          disabled={value >= max}
          aria-label={`${label}: больше`}
          className="w-8 shrink-0 text-ui font-bold text-dim transition-colors hover:text-white disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

function format(value: number): string {
  return String(round(value)).replace(".", ",");
}

/** Centimetres: the precision a tape measure actually gives. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
