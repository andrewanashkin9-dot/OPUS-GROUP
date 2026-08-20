"use client";

import { FLOOR_LABELS } from "@/lib/3d/layout";
import { STYLE_LIST } from "@/lib/3d/styles";
import type { FloorCount, SceneModel } from "@/lib/3d/types";
import { FLOOR_COUNTS } from "@/lib/3d/types";
import { useAppStore } from "@/lib/store";

/**
 * Storey count and style rebuild the house rather than re-finishing it, so
 * they sit at the top of the rail, above the surface-by-surface controls.
 */
export function HouseControls({ model }: { model: SceneModel }) {
  const setFloors = useAppStore((s) => s.setFloors);
  const setStyle = useAppStore((s) => s.setStyle);
  const rebuilding = useAppStore((s) => s.rebuilding);

  return (
    <div>
      <h3 className="text-caption font-medium uppercase text-cream-dim">
        Этажность
      </h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {FLOOR_COUNTS.map((count: FloorCount) => {
          const active = model.floors === count;
          return (
            <button
              key={count}
              type="button"
              disabled={rebuilding}
              onClick={() => setFloors(count)}
              aria-pressed={active}
              className={`rounded-xl border px-3 py-2.5 text-body-s font-medium transition-colors disabled:opacity-50 ${
                active
                  ? "border-cream-bright text-cream-bright"
                  : "border-line text-cream-dim hover:border-cream-dim"
              }`}
            >
              {FLOOR_LABELS[count]}
            </button>
          );
        })}
      </div>

      <h3 className="mt-6 text-caption font-medium uppercase text-cream-dim">
        Стиль дома
      </h3>
      <div className="mt-3 space-y-2">
        {STYLE_LIST.map((style) => {
          const active = model.style === style.id;
          return (
            <button
              key={style.id}
              type="button"
              disabled={rebuilding}
              onClick={() => setStyle(style.id)}
              aria-pressed={active}
              className={`block w-full rounded-xl border p-3 text-left transition-colors disabled:opacity-50 ${
                active
                  ? "border-cream-bright"
                  : "border-line hover:border-cream-dim"
              }`}
            >
              <span
                className={`block text-body-s font-medium ${
                  active ? "text-cream-bright" : "text-cream"
                }`}
              >
                {style.name}
              </span>
              <span className="mt-1 block text-caption leading-snug text-cream-dim">
                {style.tagline}
              </span>
            </button>
          );
        })}
      </div>

      {rebuilding && (
        <p className="mt-3 text-caption text-cream-dim" aria-live="polite">
          Перестраиваем дом…
        </p>
      )}
      <p className="mt-3 text-caption text-cream-dim">
        Смена стиля заменит материалы и цвета на характерные для него.
      </p>
    </div>
  );
}
