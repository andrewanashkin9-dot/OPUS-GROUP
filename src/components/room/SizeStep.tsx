"use client";

import {
  ROOM_LIMITS,
  metres,
  squareMetres,
  type RoomModel,
  type RoomShape,
} from "@/lib/room";
import { useAppStore, useRoomSurfaces } from "@/lib/store";
import { NumberField } from "./NumberField";

/**
 * Two plans, named the way a person describes their own room.
 *
 * "Г-образная" is what people actually say; "прямоугольная" needs no name at
 * all, which is why it is first and selected by default.
 */
const SHAPES: { id: RoomShape; label: string; hint: string }[] = [
  { id: "rect", label: "Прямоугольная", hint: "Четыре стены, четыре угла." },
  { id: "l", label: "Г-образная", hint: "Один угол срезан — ниша, короб или соседний санузел." },
];

/** Which corner of the plan is cut away, from the reader's point of view. */
const CORNERS = [
  { id: "nw", label: "Дальний левый" },
  { id: "ne", label: "Дальний правый" },
  { id: "sw", label: "Ближний левый" },
  { id: "se", label: "Ближний правый" },
] as const;

/**
 * Step one: what the tape measure said.
 *
 * Length and width are the two numbers everyone already has; height is the
 * one people guess at, so it is the one that carries the note.
 */
export function SizeStep({ room }: { room: RoomModel }) {
  const setRoomDimensions = useAppStore((s) => s.setRoomDimensions);
  const setRoomShape = useAppStore((s) => s.setRoomShape);
  const setRoomNotch = useAppStore((s) => s.setRoomNotch);
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

      <div>
        <span className="text-caption font-medium uppercase tracking-wide text-dim">
          Форма
        </span>
        <div className="mt-1.5 flex gap-1 rounded-xl border border-[var(--plate-edge)] p-1">
          {SHAPES.map((shape) => {
            const active = room.shape === shape.id;
            return (
              <button
                key={shape.id}
                type="button"
                onClick={() => setRoomShape(shape.id)}
                aria-pressed={active}
                className={`flex-1 rounded-lg px-3 py-2 text-body-s font-medium transition-colors ${
                  active ? "bg-accent text-deep" : "text-dim hover:text-white"
                }`}
              >
                {shape.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-caption text-dim">
          {SHAPES.find((s) => s.id === room.shape)?.hint}
        </p>
      </div>

      {room.shape === "l" && room.notch && (
        <div className="space-y-3 rounded-xl border border-[var(--plate-edge)] p-3">
          <div>
            <span className="text-caption font-medium uppercase tracking-wide text-dim">
              Какой угол срезан
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              {CORNERS.map((corner) => {
                const active = room.notch?.corner === corner.id;
                return (
                  <button
                    key={corner.id}
                    type="button"
                    onClick={() => setRoomNotch({ corner: corner.id })}
                    aria-pressed={active}
                    className={`rounded-lg border px-3 py-2 text-body-s font-medium transition-colors ${
                      active
                        ? "border-accent-line bg-[var(--plate-quiet)] text-white"
                        : "border-[var(--plate-edge)] text-dim hover:text-white"
                    }`}
                  >
                    {corner.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-caption text-dim">
              «Дальний» — от входа; смотрите на план в 3D, срезанный угол видно
              сразу.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Вырез вдоль ширины"
              value={room.notch.widthM}
              onChange={(widthM) => setRoomNotch({ widthM })}
              min={0.5}
              max={Math.max(0.5, room.dimensions.widthM - 1)}
            />
            <NumberField
              label="Вырез вдоль длины"
              value={room.notch.lengthM}
              onChange={(lengthM) => setRoomNotch({ lengthM })}
              min={0.5}
              max={Math.max(0.5, room.dimensions.lengthM - 1)}
            />
          </div>

          <p className="text-caption text-dim">
            Стен становится шесть, но общая длина стен не меняется: вырез
            убирает два куска и добавляет ровно такие же. Меньше становится
            только пол и потолок.
          </p>
        </div>
      )}

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
