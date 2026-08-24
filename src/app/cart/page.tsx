"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { ProductPhoto } from "@/components/market/ProductPhoto";
import { SectionTransition } from "@/components/stage/SectionTransition";
import { ButtonLink } from "@/components/Button";
import { formatRub, formatUnit } from "@/lib/format";
import { marketUnitLabel } from "@/lib/marketplace";
import { quantityStep } from "@/lib/quantity-step";
import {
  useAppStore,
  useBom,
  useCartTotal,
  useMarketLines,
  useMarketTotal,
} from "@/lib/store";

export default function CartPage() {
  const model = useAppStore((s) => s.model);
  const bom = useBom();
  const materialsTotal = useCartTotal(bom);
  const marketLines = useMarketLines();
  const marketTotal = useMarketTotal(marketLines);
  const setQuantity = useAppStore((s) => s.setQuantity);
  const setMarketQuantity = useAppStore((s) => s.setMarketQuantity);
  const removeMarketItem = useAppStore((s) => s.removeMarketItem);
  const selectNode = useAppStore((s) => s.selectNode);

  const goods = materialsTotal + marketTotal;
  const empty = bom.length === 0 && marketLines.length === 0;
  // Delivery scales with the load, with a flat call-out charge on top.
  const delivery = empty ? 0 : Math.round(goods * 0.035) + 1500;

  return (
    <>
      {/* Plays only when the reader came here from the model — the pan into
          the phone belongs to that move, not to the page. */}
      <SectionTransition id="estimate" requireArm bloom />
      <NavBar />
      <main className="mx-auto min-h-[60vh] w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-h1 font-extrabold text-cream-bright">Смета</h1>

        {empty ? (
          <div className="surface-1 mt-12 rounded-2xl border border-line p-10 text-center">
            <p className="text-body-l text-cream-dim">
              Корзина пока пуста — соберите дом в конструкторе, и материалы
              появятся здесь сами. Или добавьте позиции из магазина.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/editor">Перейти в конструктор</ButtonLink>
              <ButtonLink href="/market" variant="secondary">
                Открыть магазин
              </ButtonLink>
            </div>
          </div>
        ) : (
          <>
            {bom.length > 0 && (
              <section>
                <p className="mt-3 text-body-s text-cream-dim">
                  Каждая позиция рассчитана по геометрии вашей модели «
                  {model?.name}». Количество можно скорректировать вручную.
                </p>

                <h2 className="mt-10 text-caption font-medium uppercase text-cream-dim">
                  По модели
                </h2>
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {bom.map((line) => (
                    <li key={line.id} className="flex flex-wrap items-center gap-4 py-5">
                      <div className="min-w-0 flex-1">
                        <Link
                          href="/editor"
                          onClick={() => selectNode(line.nodeId)}
                          className="text-body font-medium text-cream transition-colors hover:text-cream-bright"
                        >
                          {line.nodeLabel}
                        </Link>
                        <p className="mt-1 text-body-s text-cream-dim">
                          {line.materialName}
                        </p>
                      </div>

                      <Stepper
                        label={line.nodeLabel}
                        onDecrement={() => setQuantity(line.nodeId, line.quantity - 1)}
                        onIncrement={() => setQuantity(line.nodeId, line.quantity + 1)}
                      >
                        {line.quantity} {formatUnit(line.unit)}
                      </Stepper>

                      <span className="w-32 shrink-0 text-right text-body-s font-bold tabular-nums text-cream-bright">
                        {formatRub(line.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {marketLines.length > 0 && (
              <section className="mt-12">
                <h2 className="text-caption font-medium uppercase text-cream-dim">
                  Из магазина
                </h2>
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {marketLines.map((line) => (
                    <li
                      key={line.product.id}
                      className="flex flex-wrap items-center gap-4 py-5"
                    >
                      <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-line">
                        <ProductPhoto id={line.product.id} alt="" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/market/${line.product.id}`}
                          className="text-body font-medium text-cream transition-colors hover:text-cream-bright"
                        >
                          {line.product.name}
                        </Link>
                        <p className="mt-1 text-body-s text-cream-dim">
                          {line.product.brand}
                        </p>
                      </div>

                      <Stepper
                        label={line.product.name}
                        onDecrement={() =>
                          setMarketQuantity(
                            line.product.id,
                            line.quantity - quantityStep(line.quantity),
                          )
                        }
                        onIncrement={() =>
                          setMarketQuantity(
                            line.product.id,
                            line.quantity + quantityStep(line.quantity),
                          )
                        }
                      >
                        {line.quantity} {marketUnitLabel(line.unit)}
                      </Stepper>

                      <span className="w-32 shrink-0 text-right text-body-s font-bold tabular-nums text-cream-bright">
                        {formatRub(line.total)}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeMarketItem(line.product.id)}
                        aria-label={`Убрать из сметы: ${line.product.name}`}
                        className="shrink-0 text-body-s text-cream-dim transition-colors hover:text-cream-bright"
                      >
                        Убрать
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-10 space-y-3 border-t border-line pt-6">
              {bom.length > 0 && (
                <TotalRow label="Материалы по модели" value={materialsTotal} />
              )}
              {marketLines.length > 0 && (
                <TotalRow label="Позиции из магазина" value={marketTotal} />
              )}
              <TotalRow label="Доставка (оценочно)" value={delivery} />
              <div className="flex items-center justify-between border-t border-line pt-3">
                <span className="font-display text-h3 font-medium text-cream-bright">
                  Итого
                </span>
                <span className="font-display text-h3 font-medium tabular-nums text-cream-bright">
                  {formatRub(goods + delivery)}
                </span>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <ButtonLink href="/services">Найти бригаду для монтажа</ButtonLink>
              <ButtonLink href="/market" variant="secondary">
                Добавить материалы
              </ButtonLink>
              {model && (
                <ButtonLink href="/editor" variant="ghost">
                  Вернуться в конструктор
                </ButtonLink>
              )}
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-body-s text-cream-dim">
      <span>{label}</span>
      <span className="tabular-nums">{formatRub(value)}</span>
    </div>
  );
}

function Stepper({
  label,
  onDecrement,
  onIncrement,
  children,
}: {
  label: string;
  onDecrement: () => void;
  onIncrement: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Уменьшить количество: ${label}`}
        onClick={onDecrement}
        className="h-8 w-8 rounded-full border border-line text-cream-dim transition-colors hover:border-cream-dim hover:text-cream-bright"
      >
        −
      </button>
      <span className="w-24 text-center text-body-s tabular-nums">{children}</span>
      <button
        type="button"
        aria-label={`Увеличить количество: ${label}`}
        onClick={onIncrement}
        className="h-8 w-8 rounded-full border border-line text-cream-dim transition-colors hover:border-cream-dim hover:text-cream-bright"
      >
        +
      </button>
    </div>
  );
}
