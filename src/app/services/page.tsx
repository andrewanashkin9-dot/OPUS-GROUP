"use client";

import { useMemo, useState } from "react";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { CREWS } from "@/lib/crews";
import { nodeKindLabel, useAppStore } from "@/lib/store";
import type { NodeKind } from "@/lib/3d/types";

export default function ServicesPage() {
  const model = useAppStore((s) => s.model);
  const [showAll, setShowAll] = useState(!model);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const requiredKinds = useMemo<NodeKind[]>(() => {
    if (!model) return [];
    return Array.from(new Set(model.nodes.map((n) => n.kind)));
  }, [model]);

  const crews = showAll
    ? CREWS
    : CREWS.filter((crew) => crew.specialties.some((s) => requiredKinds.includes(s)));

  function requestQuote(id: string) {
    setRequestedIds((prev) => new Set(prev).add(id));
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-h1 font-extrabold text-cream-bright">
          Бригады для монтажа
        </h1>
        <p className="prose-measure mt-4 text-body-l text-cream-dim">
          {model
            ? "Показаны бригады, которые закрывают именно те работы, что есть в вашей модели."
            : "Постройте модель дома в конструкторе — и здесь останутся только нужные вам бригады."}
        </p>

        {model && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-6 text-body-s font-medium text-cream underline underline-offset-2 hover:text-cream-bright"
          >
            {showAll ? "Показать только нужные для моей модели" : "Показать все бригады"}
          </button>
        )}

        <ul className="mt-10 grid gap-6 sm:grid-cols-2">
          {crews.map((crew) => {
            const requested = requestedIds.has(crew.id);
            return (
              <li
                key={crew.id}
                className="flex flex-col rounded-2xl border border-line bg-surface p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-h3 font-medium text-cream-bright">
                      {crew.name}
                    </h2>
                    <p className="mt-1 text-body-s text-cream-dim">{crew.city}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-body-s font-bold text-cream-bright">
                      ★ {crew.rating.toFixed(1)}
                    </p>
                    <p className="text-caption text-cream-dim">{crew.reviewsCount} отзывов</p>
                  </div>
                </div>

                <p className="mt-4 flex-1 text-body-s text-cream-dim">{crew.bio}</p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {crew.specialties.map((kind) => (
                    <span
                      key={kind}
                      className="rounded-full border border-line px-2.5 py-1 text-caption uppercase text-cream-dim"
                    >
                      {nodeKindLabel(kind)}
                    </span>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
                  <span className="text-body-s font-medium text-cream">
                    {crew.priceRangeLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => requestQuote(crew.id)}
                    disabled={requested}
                    className="inline-flex items-center rounded-full bg-cream px-4 py-2 text-body-s font-bold text-bg transition-colors hover:bg-cream-bright disabled:bg-transparent disabled:border disabled:border-success disabled:text-success"
                  >
                    {requested ? "Заявка отправлена ✓" : "Запросить смету"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
      <Footer />
    </>
  );
}
