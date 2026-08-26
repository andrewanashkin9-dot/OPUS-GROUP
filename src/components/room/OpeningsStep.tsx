"use client";

import {
  MIN_JAMB_M,
  OPENING_LIMITS,
  metres,
  roomWalls,
  validateOpening,
  wallById,
  type RoomModel,
  type RoomOpening,
} from "@/lib/room";
import { useAppStore } from "@/lib/store";

/**
 * Step two: doors and windows.
 *
 * Positioned by one number — the distance from the left corner of the wall
 * when you stand in the room facing it. That is the only measurement anyone
 * can repeat with a tape without first drawing a plan.
 */
export function OpeningsStep({ room }: { room: RoomModel }) {
  const addOpening = useAppStore((s) => s.addOpening);
  const selectSurface = useAppStore((s) => s.selectSurface);
  const selectedSurfaceId = useAppStore((s) => s.selectedSurfaceId);
  const walls = roomWalls(room);

  return (
    <section className="space-y-5">
      <header>
        <h2 className="font-display text-h3 font-semibold text-white">Проёмы</h2>
        <p className="mt-1 text-body-s text-dim">
          Дверь и окна вычитаются из площади стены. Отступ меряется от левого
          угла стены, если встать в комнате лицом к ней.
        </p>
      </header>

      <div className="space-y-3">
        {walls.map((wall) => {
          const openings = room.openings.filter((o) => o.wall === wall.id);
          const active = selectedSurfaceId === wall.id;
          return (
            <div
              key={wall.id}
              className={`rounded-xl border p-3 transition-colors ${
                active
                  ? "border-accent-line bg-[var(--plate-quiet)]"
                  : "border-[var(--plate-edge)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => selectSurface(wall.id)}
                  className="min-w-0 text-left"
                >
                  <span className="text-ui font-medium text-white">
                    {wall.label}
                  </span>
                  <span className="ml-2 text-body-s tabular-nums text-dim">
                    {metres(wall.lengthM, 2)} м
                  </span>
                </button>
                <div className="flex shrink-0 gap-1">
                  {(["door", "window"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => addOpening(kind, wall.id)}
                      className="rounded-full border border-[var(--plate-edge)] px-3 py-1.5 text-caption font-medium text-dim transition-colors hover:border-[var(--plate-edge-hi)] hover:text-white"
                    >
                      + {kind === "door" ? "Дверь" : "Окно"}
                    </button>
                  ))}
                </div>
              </div>

              {openings.length > 0 && (
                <ul className="mt-3 space-y-3">
                  {openings.map((opening) => (
                    <OpeningRow key={opening.id} room={room} opening={opening} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {room.openings.length === 0 && (
        <p className="text-body-s text-dim">
          Пока проёмов нет — площадь стен считается целиком.
        </p>
      )}
    </section>
  );
}

function OpeningRow({
  room,
  opening,
}: {
  room: RoomModel;
  opening: RoomOpening;
}) {
  const updateOpening = useAppStore((s) => s.updateOpening);
  const removeOpening = useAppStore((s) => s.removeOpening);

  const wall = wallById(room, opening.wall);
  const error = validateOpening(room, opening);
  const limits = OPENING_LIMITS[opening.kind];
  const maxOffset = Math.max(
    MIN_JAMB_M,
    (wall?.lengthM ?? opening.widthM) - opening.widthM - MIN_JAMB_M,
  );

  return (
    <li className="rounded-lg border border-[var(--plate-edge)] bg-[var(--plate-quiet)] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-body-s font-medium text-white">
          {opening.kind === "door" ? "Дверь" : "Окно"}{" "}
          <span className="tabular-nums text-dim">
            {metres(opening.widthM, 2)} × {metres(opening.heightM, 2)} м
          </span>
        </span>
        <button
          type="button"
          onClick={() => removeOpening(opening.id)}
          className="shrink-0 text-caption font-medium text-dim underline underline-offset-2 transition-colors hover:text-white"
        >
          Убрать
        </button>
      </div>

      <div className="mt-3 space-y-2.5">
        <Slider
          label="Отступ от левого угла"
          value={opening.offsetM}
          min={MIN_JAMB_M}
          max={maxOffset}
          onChange={(offsetM) => updateOpening(opening.id, { offsetM })}
        />
        <Slider
          label="Ширина"
          value={opening.widthM}
          min={limits.widthM.min}
          max={limits.widthM.max}
          onChange={(widthM) => updateOpening(opening.id, { widthM })}
        />
        <Slider
          label="Высота"
          value={opening.heightM}
          min={limits.heightM.min}
          max={limits.heightM.max}
          onChange={(heightM) => updateOpening(opening.id, { heightM })}
        />
        {opening.kind === "window" && (
          <Slider
            label="Низ над полом"
            value={opening.sillM}
            min={0}
            max={Math.max(0, room.dimensions.heightM - opening.heightM)}
            onChange={(sillM) => updateOpening(opening.id, { sillM })}
          />
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-caption" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}
    </li>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-caption uppercase text-dim">{label}</span>
        <span className="font-body text-body-s font-bold tabular-nums text-white">
          {metres(value, 2)} м
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="market-range mt-1 w-full"
      />
    </label>
  );
}
