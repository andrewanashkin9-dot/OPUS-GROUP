"use client";

import { squareMetres, type RoomSurface, type SurfaceId } from "@/lib/room";

interface SurfaceToolbarProps {
  surfaces: RoomSurface[];
  selectedId: SurfaceId | null;
  finishes: Partial<Record<SurfaceId, string>>;
  onSelect: (id: SurfaceId) => void;
}

/**
 * The surfaces of the room, as one row of chips over the view.
 *
 * Selection has to read three ways at once — chip, 3D surface, rail heading —
 * because each of the three is the one the reader happens to be looking at.
 */
export function SurfaceToolbar({
  surfaces,
  selectedId,
  finishes,
  onSelect,
}: SurfaceToolbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface/95 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
        {surfaces.map((surface) => {
          const active = selectedId === surface.id;
          return (
            <button
              key={surface.id}
              type="button"
              onClick={() => onSelect(surface.id)}
              aria-pressed={active}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-body-s font-medium transition-colors sm:px-4 ${
                active ? "bg-accent text-deep" : "text-dim hover:text-white"
              }`}
            >
              {surface.label}
              <span className="tabular-nums opacity-70">
                {squareMetres(surface.netM2)}
              </span>
              {/* A finished surface is marked, not described: the rail says
                  which material, the chip only says whether one is chosen. */}
              {finishes[surface.id] && (
                <span
                  aria-label="материал выбран"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: active ? "var(--deep)" : "var(--accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
