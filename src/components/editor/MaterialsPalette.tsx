"use client";

import { useState } from "react";
import Link from "next/link";
import { educationCardForKind } from "@/lib/3d/education";
import { materialsForKind } from "@/lib/3d/materials";
import type { SceneNode } from "@/lib/3d/types";
import { formatRub, formatUnit } from "@/lib/format";
import { effectiveColor, useAppStore } from "@/lib/store";
import { TextureSwatch } from "./TextureSwatch";

interface MaterialsPaletteProps {
  node: SceneNode;
  compact?: boolean;
}

export function MaterialsPalette({ node, compact = false }: MaterialsPaletteProps) {
  const tier = useAppStore((s) => s.tier);
  const applyMaterial = useAppStore((s) => s.applyMaterial);
  const showEducationCard = useAppStore((s) => s.showEducationCard);
  const error = useAppStore((s) => s.error);
  const colorOverrides = useAppStore((s) => s.colorOverrides);
  const [lockedAttemptId, setLockedAttemptId] = useState<string | null>(null);
  // Swatches preview each texture in the colour the surface is wearing now.
  const previewColor = effectiveColor(node, colorOverrides);

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
              <TextureSwatch
                textureId={material.textureId}
                color={previewColor}
                size={compact ? 34 : 40}
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

      {error && (
        <p className="mt-4 text-body-s text-error" role="alert">
          {error} Попробуйте выбрать материал ещё раз.
        </p>
      )}

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
