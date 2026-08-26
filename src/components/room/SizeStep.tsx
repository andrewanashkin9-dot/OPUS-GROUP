"use client";

import { ROOM_LIMITS, metres, squareMetres, type RoomModel } from "@/lib/room";
import { useAppStore, useRoomSurfaces } from "@/lib/store";
import { NumberField } from "./NumberField";

/**
 * Step one: what the tape measure said.
 *
 * Length and width are the two numbers everyone already has; height is the
 * one people guess at, so it is the one that carries the note.
 */
export function SizeStep({ room }: { room: RoomModel }) {
  const setRoomDimensions = useAppStore((s) => s.setRoomDimensions);
  const surfaces = useRoomSurfaces();

  const floor = surfaces.find((s) => s.kind === "floor");
  const walls = surfaces.filter((s) => s.kind === "wall");
  const wallArea = walls.reduce((sum, s) => sum + s.netM2, 0);
  const perimeter = walls.reduce((sum, s) => sum + s.runM, 0);

  return (
    <section className="space-y-5">
      <header>
        <h2 className="font-display text-h3 font-semibold text-white">Размеры</h2>
        <p className="mt-1 text-body-s text-dim">
          Померьте по полу вдоль стен. Если стены не совсем параллельны,
          берите большее из двух значений — материала уйдёт не меньше.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Ширина"
          value={room.dimensions.widthM}
          onChange={(widthM) => setRoomDimensions({ widthM })}
          min={ROOM_LIMITS.widthM.min}
          max={ROOM_LIMITS.widthM.max}
        />
        <NumberField
          label="Длина"
          value={room.dimensions.lengthM}
          onChange={(lengthM) => setRoomDimensions({ lengthM })}
          min={ROOM_LIMITS.lengthM.min}
          max={ROOM_LIMITS.lengthM.max}
        />
        <NumberField
          label="Высота"
          value={room.dimensions.heightM}
          onChange={(heightM) => setRoomDimensions({ heightM })}
          min={ROOM_LIMITS.heightM.min}
          max={ROOM_LIMITS.heightM.max}
        />
      </div>
      <p className="-mt-2 text-caption text-dim">
        Высота в панельном доме обычно 2,5–2,7 м, в сталинке — от трёх.
      </p>

      <dl className="grid grid-cols-3 overflow-hidden rounded-xl border border-[var(--plate-edge)]">
        {[
          { label: "Пол", value: squareMetres(floor?.netM2 ?? 0) },
          { label: "Стены", value: squareMetres(wallArea) },
          { label: "Периметр", value: `${metres(perimeter, 1)} м` },
        ].map((entry) => (
          <div
            key={entry.label}
            className="border-r border-[var(--plate-edge)] px-3 py-2.5 last:border-r-0"
          >
            <dt className="text-caption uppercase text-dim">{entry.label}</dt>
            <dd className="mt-0.5 font-body text-ui font-bold tabular-nums text-white">
              {entry.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
