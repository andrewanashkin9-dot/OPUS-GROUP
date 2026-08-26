"use client";

import {
  photoSources,
  priceUnitLabel,
  productsForSurface,
  type Product,
} from "@/lib/marketplace";
import { formatRub } from "@/lib/format";
import { ROOM_LIMITS, percent, squareMetres, type RoomModel } from "@/lib/room";
import { useAppStore, useRoomSurfaces } from "@/lib/store";
import { PhotoRefs } from "./PhotoRefs";

/**
 * Step three: what goes on the selected surface.
 *
 * Scoped, not filtered after the fact: a ceiling is never offered a floor
 * tile, so nothing here has to be ruled out by reading the small print.
 */
export function FinishStep({ room }: { room: RoomModel }) {
  const surfaces = useRoomSurfaces();
  const selectedSurfaceId = useAppStore((s) => s.selectedSurfaceId);
  const setFinish = useAppStore((s) => s.setFinish);
  const setWallFinish = useAppStore((s) => s.setWallFinish);
  const setWastePct = useAppStore((s) => s.setWastePct);

  const surface = surfaces.find((s) => s.id === selectedSurfaceId) ?? surfaces[0];
  if (!surface) return null;

  const products = productsForSurface(surface.kind);
  const chosen = room.finishes[surface.id];

  return (
    <section className="space-y-5">
      <header>
        <h2 className="font-display text-h3 font-semibold text-white">
          Отделка · {surface.label}
        </h2>
        <p className="mt-1 text-body-s text-dim">
          {squareMetres(surface.netM2)} под отделку
          {surface.openingsM2 > 0 &&
            ` — проёмы вычтены (${squareMetres(surface.openingsM2)})`}
          . Поверхность выбирается снизу или прямо в 3D.
        </p>
      </header>

      <ul className="grid gap-2">
        {products.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            chosen={chosen === product.id}
            onChoose={() =>
              setFinish(surface.id, chosen === product.id ? null : product.id)
            }
          />
        ))}
      </ul>

      {surface.kind === "wall" && chosen && (
        <button
          type="button"
          onClick={() => setWallFinish(chosen)}
          className="w-full rounded-xl border border-[var(--plate-edge)] px-4 py-2.5 text-body-s font-medium text-white transition-colors hover:border-[var(--plate-edge-hi)]"
        >
          Применить ко всем стенам
        </button>
      )}

      <label className="block rounded-xl border border-[var(--plate-edge)] p-3">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-caption uppercase text-dim">
            Запас на подрезку
          </span>
          <span className="font-body text-ui font-bold tabular-nums text-accent">
            {percent(room.wastePct)}
          </span>
        </span>
        <input
          type="range"
          min={ROOM_LIMITS.wastePct.min}
          max={ROOM_LIMITS.wastePct.max}
          step={1}
          value={room.wastePct}
          onChange={(e) => setWastePct(Number(e.target.value))}
          className="market-range mt-2 w-full"
        />
        <span className="mt-2 block text-caption text-dim">
          Плитку и ламинат режут по месту, и обрезки в дело уже не идут. Десять
          процентов — обычный запас для прямой раскладки; для диагональной или
          «ёлочки» берут пятнадцать.
        </span>
      </label>

      <PhotoRefs />
    </section>
  );
}

function ProductRow({
  product,
  chosen,
  onChoose,
}: {
  product: Product;
  chosen: boolean;
  onChoose: () => void;
}) {
  const photo = photoSources(product.id);

  return (
    <li>
      <button
        type="button"
        onClick={onChoose}
        aria-pressed={chosen}
        className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors ${
          chosen
            ? "border-accent-line bg-[var(--plate-quiet)]"
            : "border-[var(--plate-edge)] hover:border-[var(--plate-edge-hi)]"
        }`}
      >
        <picture>
          <source srcSet={photo.webp} type="image/webp" />
          <img
            src={photo.fallback}
            alt=""
            width={64}
            height={48}
            loading="lazy"
            className="h-12 w-16 shrink-0 rounded-md object-cover"
          />
        </picture>
        <span className="min-w-0 flex-1">
          {/* Two lines, not an ellipsis: the half of the name that gets cut
              is the half that says which product it is. */}
          <span className="block text-body-s font-medium leading-snug text-white">
            {product.name}
          </span>
          <span className="mt-0.5 block text-caption text-dim">
            {product.brand} · {formatRub(product.price)}{" "}
            {priceUnitLabel(product.unit)}
          </span>
        </span>
        {chosen && (
          <span
            aria-hidden="true"
            className="shrink-0 text-caption font-medium uppercase text-accent"
          >
            Выбрано
          </span>
        )}
      </button>
    </li>
  );
}
