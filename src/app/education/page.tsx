"use client";

import { useState } from "react";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { EDUCATION_CARDS } from "@/lib/3d/education";
import type { NodeKind } from "@/lib/3d/types";
import { nodeKindLabel } from "@/lib/store";

const KINDS: NodeKind[] = ["roof", "facade", "fence", "foundation", "window"];

export default function EducationPage() {
  const [activeKind, setActiveKind] = useState<NodeKind | "all">("all");

  const cards =
    activeKind === "all"
      ? EDUCATION_CARDS
      : EDUCATION_CARDS.filter((c) => c.nodeKind === activeKind);

  return (
    <>
      <NavBar />
      <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-h1 font-extrabold text-cream-bright">
          База знаний
        </h1>
        <p className="prose-measure mt-4 text-body-l text-cream-dim">
          Те же подсказки, что появляются в конструкторе в момент выбора —
          здесь их можно читать без привязки к своей модели.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          <FilterChip
            active={activeKind === "all"}
            onClick={() => setActiveKind("all")}
            label="Все темы"
          />
          {KINDS.map((kind) => (
            <FilterChip
              key={kind}
              active={activeKind === kind}
              onClick={() => setActiveKind(kind)}
              label={nodeKindLabel(kind)}
            />
          ))}
        </div>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2">
          {cards.map((card) => (
            <li key={card.id} className="rounded-2xl border border-line bg-surface p-6">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-line px-2.5 py-1 text-caption uppercase text-cream-dim">
                  {card.tag}
                </span>
                <span className="text-caption uppercase text-cream-dim">
                  {nodeKindLabel(card.nodeKind)}
                </span>
              </div>
              <h2 className="font-display mt-3 text-h3 font-medium text-cream-bright">
                {card.title}
              </h2>
              <p className="mt-2 text-body-s text-cream-dim">{card.body}</p>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-2 text-body-s font-medium transition-colors ${
        active
          ? "border-cream-bright bg-cream text-bg"
          : "border-line text-cream-dim hover:border-cream-dim hover:text-cream-bright"
      }`}
    >
      {label}
    </button>
  );
}
