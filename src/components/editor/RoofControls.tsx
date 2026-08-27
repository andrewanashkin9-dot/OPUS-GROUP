"use client";

import Link from "next/link";
import { ROOF_SHAPE_LABELS } from "@/lib/3d/roof-geometry";
import type { RoofShape, SceneNode } from "@/lib/3d/types";
import { useAppStore } from "@/lib/store";

const SHAPES: RoofShape[] = ["gable", "hip", "mansard", "flat"];

/**
 * Roof form is free ("pick a roof format"); the exact pitch is a precise
 * dimension and sits behind the subscription, shown but locked so the value
 * of upgrading is legible rather than hidden.
 */
export function RoofControls({ node }: { node: SceneNode }) {
  const tier = useAppStore((s) => s.tier);
  const setRoofShape = useAppStore((s) => s.setRoofShape);
  const setRoofPitch = useAppStore((s) => s.setRoofPitch);
  const roof = node.roof;

  if (!roof) return null;
  const pitchLocked = tier === "free";

  return (
    <div>
      <h3 className="text-caption font-medium uppercase text-cream-dim">
        Форма крыши
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {SHAPES.map((shape) => {
          const active = roof.shape === shape;
          return (
            <button
              key={shape}
              type="button"
              onClick={() => setRoofShape(shape)}
              aria-pressed={active}
              className={`rounded-xl border px-3 py-2.5 text-body-s font-medium transition-colors ${
                active
                  ? "border-cream-bright text-cream-bright"
                  : "border-line text-cream-dim hover:border-cream-dim"
              }`}
            >
              {ROOF_SHAPE_LABELS[shape]}
            </button>
          );
        })}
      </div>

      {roof.shape !== "flat" && (
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-2">
            <label
              htmlFor="roof-pitch"
              className="text-caption font-medium uppercase text-cream-dim"
            >
              Угол ската
            </label>
            <span className="text-body-s font-bold tabular-nums text-cream-bright">
              {roof.pitchDeg}°
            </span>
          </div>
          <input
            id="roof-pitch"
            type="range"
            min={10}
            max={55}
            step={1}
            value={roof.pitchDeg}
            disabled={pitchLocked}
            onChange={(e) => setRoofPitch(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)] disabled:opacity-40"
          />
          {pitchLocked ? (
            <p className="mt-2 text-caption text-cream-dim">
              Точный угол — в подписке «Technic».{" "}
              <Link
                href="/subscribe"
                className="font-medium text-cream-bright underline underline-offset-2"
              >
                Подключить
              </Link>
            </p>
          ) : (
            <p className="mt-2 text-caption text-cream-dim">
              Свес кровли — {roof.overhangM} м с каждой стороны.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
