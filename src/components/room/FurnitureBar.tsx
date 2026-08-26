"use client";

import { FURNITURE, furnitureDef, type RoomModel } from "@/lib/room";
import { useAppStore } from "@/lib/store";

/**
 * The furniture controls, over the view.
 *
 * Two states, and the difference matters: with nothing selected it is a short
 * list of things you can add; with a piece selected it is what you can do to
 * that piece. Putting both on screen at once turns nine buttons into
 * eighteen, and the reader has to read all of them to find the one that
 * removes a chair.
 */
export function FurnitureBar({ room }: { room: RoomModel }) {
  const selectedId = useAppStore((s) => s.selectedFurnitureId);
  const selectFurniture = useAppStore((s) => s.selectFurniture);
  const replaceFurniture = useAppStore((s) => s.replaceFurniture);
  const rotateFurniture = useAppStore((s) => s.rotateFurniture);
  const removeFurniture = useAppStore((s) => s.removeFurniture);
  const addFurniture = useAppStore((s) => s.addFurniture);
  const resetFurniture = useAppStore((s) => s.resetFurniture);

  const selected = room.furniture.find((item) => item.id === selectedId);

  if (!selected) {
    return (
      <div className="pointer-events-none absolute right-4 top-4 flex max-w-[calc(100%-2rem)] flex-col items-end gap-2">
        <details className="pointer-events-auto rounded-2xl border border-line bg-surface/95 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-body-s font-medium text-white">
            Обстановка
          </summary>
          <div className="border-t border-[var(--plate-edge)] p-3">
            <p className="mb-2 max-w-[15rem] text-caption text-dim">
              Мебель — только для наглядности: на смету она не влияет.
              Перетащите любой предмет мышью.
            </p>
            <ul className="grid grid-cols-2 gap-1">
              {FURNITURE.map((def) => (
                <li key={def.kind}>
                  <button
                    type="button"
                    onClick={() => addFurniture(def.kind)}
                    className="w-full rounded-lg border border-[var(--plate-edge)] px-2.5 py-1.5 text-left text-caption font-medium text-dim transition-colors hover:border-[var(--plate-edge-hi)] hover:text-white"
                  >
                    + {def.label}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={resetFurniture}
              className="mt-2 w-full text-caption font-medium text-dim underline underline-offset-2 transition-colors hover:text-white"
            >
              Вернуть исходную расстановку
            </button>
          </div>
        </details>
      </div>
    );
  }

  const def = furnitureDef(selected.kind);

  return (
    <div className="pointer-events-none absolute right-4 top-4 flex max-w-[calc(100%-2rem)] justify-end">
      <div className="pointer-events-auto w-[15rem] rounded-2xl border border-line bg-surface/95 p-3 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-ui font-medium text-white">{def.label}</h3>
          <button
            type="button"
            onClick={() => selectFurniture(null)}
            aria-label="Снять выделение"
            className="-mr-1 -mt-1 shrink-0 px-1.5 text-body-s text-dim transition-colors hover:text-white"
          >
            ×
          </button>
        </div>

        <ul className="mt-2 space-y-1">
          {def.variants.map((variant) => {
            const active = variant.id === selected.variant;
            return (
              <li key={variant.id}>
                <button
                  type="button"
                  onClick={() => replaceFurniture(selected.id, variant.id)}
                  aria-pressed={active}
                  className={`flex w-full items-baseline justify-between gap-2 rounded-lg px-2.5 py-1.5 text-caption font-medium transition-colors ${
                    active
                      ? "bg-accent text-deep"
                      : "text-dim hover:bg-[var(--plate-quiet)] hover:text-white"
                  }`}
                >
                  {variant.label}
                  <span className="shrink-0 tabular-nums opacity-70">
                    {variant.widthM.toLocaleString("ru-RU")} ×{" "}
                    {variant.depthM.toLocaleString("ru-RU")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-2 flex gap-1">
          {!def.ceiling && (
            <button
              type="button"
              onClick={() => rotateFurniture(selected.id)}
              className="flex-1 rounded-lg border border-[var(--plate-edge)] px-2.5 py-1.5 text-caption font-medium text-dim transition-colors hover:border-[var(--plate-edge-hi)] hover:text-white"
            >
              Повернуть
            </button>
          )}
          <button
            type="button"
            onClick={() => removeFurniture(selected.id)}
            className="flex-1 rounded-lg border border-[var(--plate-edge)] px-2.5 py-1.5 text-caption font-medium transition-colors hover:border-[var(--plate-edge-hi)]"
            style={{ color: "var(--error)" }}
          >
            Удалить
          </button>
        </div>

        <p className="mt-2 text-caption text-dim">Перетащите мышью, чтобы двигать.</p>
      </div>
    </div>
  );
}
