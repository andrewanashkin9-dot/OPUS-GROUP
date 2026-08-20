"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { ButtonLink } from "@/components/Button";
import { formatRub, formatUnit } from "@/lib/format";
import { useAppStore, useBom, useCartTotal } from "@/lib/store";

export default function CartPage() {
  const model = useAppStore((s) => s.model);
  const bom = useBom();
  const total = useCartTotal(bom);
  const setQuantity = useAppStore((s) => s.setQuantity);
  const selectNode = useAppStore((s) => s.selectNode);

  const delivery = model ? Math.round(total * 0.035) + 1500 : 0;

  return (
    <>
      <NavBar />
      <main className="mx-auto min-h-[60vh] max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-h1 font-extrabold text-cream-bright">Смета</h1>

        {!model || bom.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-line bg-surface p-10 text-center">
            <p className="text-body-l text-cream-dim">
              Корзина пока пуста — соберите дом в конструкторе, и материалы
              появятся здесь сами.
            </p>
            <ButtonLink href="/editor" className="mt-6 inline-flex">
              Перейти в конструктор
            </ButtonLink>
          </div>
        ) : (
          <>
            <p className="mt-3 text-body-s text-cream-dim">
              Каждая позиция рассчитана по геометрии вашей модели «{model.name}».
              Количество можно скорректировать вручную.
            </p>

            <ul className="mt-10 divide-y divide-line border-t border-line">
              {bom.map((line) => (
                <li key={line.id} className="flex flex-wrap items-center gap-4 py-5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href="/editor"
                      onClick={() => selectNode(line.nodeId)}
                      className="text-body font-medium text-cream hover:text-cream-bright"
                    >
                      {line.nodeLabel}
                    </Link>
                    <p className="mt-1 text-body-s text-cream-dim">{line.materialName}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Уменьшить количество: ${line.nodeLabel}`}
                      onClick={() => setQuantity(line.nodeId, line.quantity - 1)}
                      className="h-8 w-8 rounded-full border border-line text-cream-dim hover:border-cream-dim hover:text-cream-bright"
                    >
                      −
                    </button>
                    <span className="w-20 text-center text-body-s tabular-nums">
                      {line.quantity} {formatUnit(line.unit)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Увеличить количество: ${line.nodeLabel}`}
                      onClick={() => setQuantity(line.nodeId, line.quantity + 1)}
                      className="h-8 w-8 rounded-full border border-line text-cream-dim hover:border-cream-dim hover:text-cream-bright"
                    >
                      +
                    </button>
                  </div>

                  <span className="w-32 shrink-0 text-right text-body-s font-bold tabular-nums text-cream-bright">
                    {formatRub(line.total)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 space-y-3 border-t border-line pt-6">
              <div className="flex items-center justify-between text-body-s text-cream-dim">
                <span>Материалы</span>
                <span className="tabular-nums">{formatRub(total)}</span>
              </div>
              <div className="flex items-center justify-between text-body-s text-cream-dim">
                <span>Доставка (оценочно)</span>
                <span className="tabular-nums">{formatRub(delivery)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-3">
                <span className="text-h3 font-display font-medium text-cream-bright">
                  Итого
                </span>
                <span className="text-h3 font-display font-medium tabular-nums text-cream-bright">
                  {formatRub(total + delivery)}
                </span>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <ButtonLink href="/services">Найти бригаду для монтажа</ButtonLink>
              <ButtonLink href="/editor" variant="secondary">
                Вернуться в конструктор
              </ButtonLink>
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
