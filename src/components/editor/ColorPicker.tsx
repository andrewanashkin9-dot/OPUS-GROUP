"use client";

import { colorsForKind } from "@/lib/3d/palette";
import type { SceneNode } from "@/lib/3d/types";
import { effectiveColor, useAppStore } from "@/lib/store";

/**
 * Colour is a free-tier control by design — it is the first thing a visitor
 * changes, and seeing their own house in their own colour is what makes the
 * rest of the configurator worth learning.
 */
export function ColorPicker({
  node,
  compact = false,
}: {
  node: SceneNode;
  compact?: boolean;
}) {
  const colorOverrides = useAppStore((s) => s.colorOverrides);
  const setColor = useAppStore((s) => s.setColor);
  const current = effectiveColor(node, colorOverrides);
  const options = colorsForKind(node.kind);

  if (options.length === 0) return null;

  return (
    <div>
      <h3 className="text-caption font-medium uppercase text-cream-dim">
        Цвет — {node.label.toLowerCase()}
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = current.toLowerCase() === option.hex.toLowerCase();
          return (
            <button
              key={option.hex}
              type="button"
              onClick={() => setColor(node.id, option.hex)}
              title={option.name}
              aria-label={`Цвет: ${option.name}`}
              aria-pressed={active}
              className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${
                active ? "border-cream-bright" : "border-line"
              }`}
              style={{ background: option.hex }}
            />
          );
        })}
      </div>
      {!compact && (
        <p className="mt-2 text-caption text-cream-dim">
          {options.find(
            (o) => o.hex.toLowerCase() === current.toLowerCase(),
          )?.name ?? "Свой цвет"}
        </p>
      )}
    </div>
  );
}
