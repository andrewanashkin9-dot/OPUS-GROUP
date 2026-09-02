"use client";

import Link from "next/link";
import { marketUnitLabel } from "@/lib/marketplace";
import { formatRub } from "@/lib/format";
import { percent, squareMetres, type RoomModel } from "@/lib/room";
import { useAppStore, useRoomEstimate } from "@/lib/store";

/**
 * Step four: what it costs.
 *
 * Two tables, because they answer two questions. The surfaces are where the
 * reader checks their own measurements; the shopping list is what they take
 * to the merchant, rolled up per product — one bucket of paint covers four
 * walls, and a row of "1 ведро" against each wall would sell them four.
 *
 * The waste allowance stays its own column rather than folded into the area:
 * a single number with ten percent already baked in becomes, a month later,
 * a measurement nobody can check.
 */
export function EstimateStep({ room }: { room: RoomModel }) {
  const estimate = useRoomEstimate();
  const addRoomToCart = useAppStore((s) => s.addRoomToCart);
  const setRoomStep = useAppStore((s) => s.setRoomStep);
  const selectSurface = useAppStore((s) => s.selectSurface);

  if (!estimate) return null;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="font-display text-h3 font-semibold text-white">Расчёт</h2>
        <p className="mt-1 text-body-s text-dim">
          Площади — по вашим замерам, за вычетом проёмов. Запас на подрезку —{" "}
          {percent(room.wastePct)}, он показан отдельной величиной.
        </p>
      </header>

      {estimate.lines.length > 0 ? (
        <>
          <div>
            <h3 className="text-caption font-medium uppercase tracking-wide text-dim">
              Поверхности
            </h3>
            <table className="mt-2 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--plate-edge)]">
                  {["Поверхность", "Площадь", "С запасом"].map((head, i) => (
                    <th
                      key={head}
                      scope="col"
                      className={`whitespace-nowrap py-2 text-caption font-medium uppercase text-dim ${
                        i > 0 ? "pl-3 text-right" : ""
                      }`}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estimate.lines.map((line) => (
                  <tr
                    key={line.surface.id}
                    className="border-b border-[var(--plate-edge)] last:border-b-0"
                  >
                    <th scope="row" className="py-2.5 pr-3 font-normal">
                      <span className="block text-body-s font-medium text-white">
                        {line.surface.label}
                      </span>
                      <span className="block text-caption text-dim">
                        {line.product.name}
                      </span>
                    </th>
                    <td className="py-2.5 text-right text-body-s tabular-nums text-dim">
                      {squareMetres(line.areaM2)}
                    </td>
                    <td className="py-2.5 pl-3 text-right text-body-s tabular-nums text-white">
                      {squareMetres(line.areaWithWasteM2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-caption font-medium uppercase tracking-wide text-dim">
              Что покупать
            </h3>
            <ul className="mt-2 space-y-2">
              {estimate.purchases.map((purchase) => (
                <li
                  key={purchase.product.id}
                  className="flex items-start justify-between gap-3 border-b border-[var(--plate-edge)] pb-2.5 last:border-b-0"
                >
                  <span className="min-w-0">
                    <span className="block text-body-s font-medium leading-snug text-white">
                      {purchase.product.name}
                    </span>
                    <span className="mt-0.5 block text-caption text-dim">
                      {purchase.surfaces.map((s) => s.label).join(", ")} ·{" "}
                      {squareMetres(purchase.areaWithWasteM2)} с запасом
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-body text-body-s font-bold tabular-nums text-white">
                      {purchase.quantity === null
                        ? "—"
                        : `${purchase.quantity} ${marketUnitLabel(purchase.unit)}`}
                    </span>
                    <span className="mt-0.5 block text-caption tabular-nums text-dim">
                      {purchase.quantity === null
                        ? "расход уточняется"
                        : formatRub(purchase.total)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <p className="text-body-s text-dim">
          Материалы ещё не выбраны — считать нечего.
        </p>
      )}

      {estimate.unfinished.length > 0 && (
        <div className="rounded-xl border border-[var(--plate-edge)] p-3">
          <p className="text-body-s text-white">
            Без отделки {unfinishedLabel(estimate.unfinished.length)}:
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {estimate.unfinished.map((surface) => (
              <li key={surface.id}>
                <button
                  type="button"
                  onClick={() => {
                    selectSurface(surface.id);
                    setRoomStep("finish");
                  }}
                  className="rounded-full border border-[var(--plate-edge)] px-3 py-1.5 text-caption font-medium text-dim transition-colors hover:border-[var(--plate-edge-hi)] hover:text-white"
                >
                  {surface.label} · {squareMetres(surface.netM2)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3 border-t border-accent-line pt-4">
        <span className="text-ui font-medium text-white">Материалы</span>
        <span className="font-body text-h3 font-bold tabular-nums text-accent">
          {formatRub(estimate.total)}
        </span>
      </div>
      <p className="text-caption text-dim">
        Только материалы. Работа, доставка и подъём считаются отдельно —
        подрядчик берёт их от площади, которую вы уже посчитали здесь.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRoomToCart}
          disabled={estimate.purchases.length === 0}
          className="min-h-11 flex-1 rounded-full bg-accent px-5 py-3 text-ui font-bold text-deep shadow-[var(--lift-1)] transition-[filter] hover:brightness-108 disabled:opacity-40"
        >
          Перенести в смету
        </button>
        <Link
          href="/cart"
          className="rounded-full border border-[var(--plate-edge)] px-5 py-3 text-ui font-medium text-white transition-colors hover:border-[var(--plate-edge-hi)]"
        >
          Открыть смету
        </Link>
      </div>
    </section>
  );
}

function unfinishedLabel(count: number): string {
  const tail = count % 100 >= 11 && count % 100 <= 14 ? 2 : Math.min(count % 10, 5);
  const word =
    tail === 1 ? "поверхность" : tail >= 2 && tail <= 4 ? "поверхности" : "поверхностей";
  return `${count} ${word}`;
}
