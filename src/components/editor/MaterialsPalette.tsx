"use client";

import { useState } from "react";
import Link from "next/link";
import { educationCardForKind } from "@/lib/3d/education";
import { materialsForKind } from "@/lib/3d/materials";
import type { SceneNode } from "@/lib/3d/types";
import { formatRub, formatUnit } from "@/lib/format";
import { useAppStore } from "@/lib/store";

interface MaterialsPaletteProps {
  node: SceneNode;
  compact?: boolean;
}

export function MaterialsPalette({ node, compact = false }: MaterialsPaletteProps) {
  const tier = useAppStore((s) => s.tier);
  const applyMaterial = useAppStore((s) => s.applyMaterial);
  const showEducationCard = useAppStore((s) => s.showEducationCard);
  const [lockedAttemptId, setLockedAttemptId] = useState<string | null>(null);

  const options = materialsForKind(node.kind);

  async function handlePick(materialId: string, locked: boolean) {
    if (locked) {
      setLockedAttemptId(materialId);
      return;
    }
    setLockedAttemptId(null);
    await applyMaterial(node.id, materialId);
    const card = educationCardForKind(node.kind, materialId);
    if (card) showEducationCard(card.id);
  }

  return (
    <div>
      <h3 className="text-caption font-medium uppercase text-cream-dim">Материалы</h3>
      <div className={`mt-3 grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2"}`}>
        {options.map((material) => {
          const locked = tier === "free" && material.tier === "pro";
          const selected = node.materialId === material.id;
          return (
            <button
              key={material.id}
              type="button"
              onClick={() => handlePick(material.id, locked)}
              className={`relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
                selected
                  ? "border-cream-bright"
                  : "border-line hover:border-cream-dim"
              } ${locked ? "opacity-70" : ""}`}
            >
              <span
                className="h-8 w-8 rounded-full border border-line"
                style={{ background: material.colorHex }}
                aria-hidden="true"
              />
              {!compact && (
                <>
                  <span className="text-body-s font-medium text-cream leading-tight">
                    {material.name}
                  </span>
                  <span className="text-caption text-cream-dim">
                    {formatRub(material.pricePerUnit)} / {formatUnit(material.unit)}
                  </span>
                </>
              )}
              {locked && (
                <span className="absolute right-2 top-2 rounded-full border border-line bg-bg px-2 py-0.5 text-caption font-medium uppercase text-cream-dim">
                  Technic
                </span>
              )}
            </button>
          );
        })}
      </div>

      {lockedAttemptId && (
        <div className="mt-4 rounded-xl border border-line bg-bg p-4">
          <p className="text-body-s text-cream">
            Этот материал доступен в подписке «Technic» — вместе с точными
            размерами и полной спецификацией.
          </p>
          <Link
            href="/#pricing"
            className="mt-3 inline-flex items-center text-body-s font-bold text-cream-bright underline underline-offset-2"
          >
            Оформить подписку за 700 ₽/мес
          </Link>
        </div>
      )}
    </div>
  );
}
