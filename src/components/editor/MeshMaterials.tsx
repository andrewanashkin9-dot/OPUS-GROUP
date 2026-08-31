"use client";

import { materialsForKind } from "@/lib/3d/materials";
import type { MeshPart } from "@/lib/3d/mesh-segmentation";
import type { NodeKind } from "@/lib/3d/types";
import { useAppStore } from "@/lib/store";
import { TextureSwatch } from "./TextureSwatch";

/**
 * Материалы на модели, построенной по фотографии.
 *
 * Меш приходит от вендора одним куском без разметки: ни имён, ни материалов —
 * сплошная лента треугольников. Части дома восстанавливаются из геометрии по
 * наклону и размеру поверхностей (см. mesh-segmentation.ts), и уже к ним
 * применяется выбор.
 *
 * Три раздела, а не отдельная кнопка на каждую стену, потому что больше
 * геометрия и не даёт: сказать «эта стена — задний фасад» по одному мешу
 * нельзя, а обещать такую точность интерфейсом — врать.
 *
 * «Как на фото» — не сброс к умолчанию, а возврат материала вендора: он
 * несёт похожесть на настоящий дом, ради которой модель и заказывали.
 */

const SECTIONS: { part: MeshPart; label: string; kind: NodeKind; hint: string }[] = [
  { part: "roof", label: "Кровля", kind: "roof", hint: "Скаты и плоские участки крыши" },
  { part: "wall", label: "Стены", kind: "facade", hint: "Вертикальные плоскости фасада" },
  {
    part: "minor",
    label: "Детали",
    kind: "facade",
    hint: "Козырьки, трубы, карнизы — всё мелкое",
  },
];

export function MeshMaterials() {
  const chosen = useAppStore((s) => s.meshMaterials);
  const setMeshMaterial = useAppStore((s) => s.setMeshMaterial);
  const tier = useAppStore((s) => s.tier);

  return (
    <div>
      <h3 className="text-caption font-medium uppercase text-cream-dim">
        Материалы на модели
      </h3>
      <p className="mt-2 text-caption leading-snug text-cream-dim">
        Части найдены по геометрии: наклон говорит, кровля это или стена, а
        размер отделяет мелочь — козырёк лежит под углом ската, но крышей не
        является.
      </p>

      {SECTIONS.map((section) => {
        const options = materialsForKind(section.kind);
        const active = chosen[section.part];
        return (
          <section key={section.part} className="mt-4">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-body-s font-medium text-cream">{section.label}</h4>
              {active && (
                <button
                  type="button"
                  onClick={() => setMeshMaterial(section.part, null)}
                  className="shrink-0 text-caption text-dim underline underline-offset-2 transition-colors hover:text-white"
                >
                  Как на фото
                </button>
              )}
            </div>
            <p className="text-caption text-cream-dim">{section.hint}</p>

            <div className="mt-2 grid grid-cols-4 gap-2">
              {options.map((material) => {
                const locked = tier === "free" && material.tier === "pro";
                const selected = active === material.id;
                return (
                  <button
                    key={material.id}
                    type="button"
                    disabled={locked}
                    title={`${material.name}${locked ? " — тариф Про" : ""}`}
                    aria-pressed={selected}
                    onClick={() => setMeshMaterial(section.part, material.id)}
                    className={`rounded-lg border p-1 transition-colors disabled:opacity-40 ${
                      selected
                        ? "border-cream-bright"
                        : "border-[var(--plate-edge)] hover:border-cream-dim"
                    }`}
                  >
                    <TextureSwatch
                      textureId={material.textureId}
                      color={material.colorHex}
                    />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
