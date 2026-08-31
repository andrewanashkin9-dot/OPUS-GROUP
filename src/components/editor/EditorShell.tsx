"use client";

import { useState } from "react";
import { TitleBlock } from "@/components/TitleBlock";
import { formatRub } from "@/lib/format";
import { useAppStore, useBom, useCartTotal } from "@/lib/store";
import { BomPanel } from "./BomPanel";
import { ColorPicker } from "./ColorPicker";
import { EditorCanvas } from "./EditorCanvas";
import { EducationCardPanel } from "./EducationCardPanel";
import { FootprintControls } from "./FootprintControls";
import { HouseControls } from "./HouseControls";
import { MaterialsPalette } from "./MaterialsPalette";
import { RoofControls } from "./RoofControls";
import { Toolbar } from "./Toolbar";
import { TopBar } from "./TopBar";
import { UploadStep } from "./UploadStep";
import { VendorNotice } from "./VendorNotice";

export function EditorShell() {
  const model = useAppStore((s) => s.model);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const selectNode = useAppStore((s) => s.selectNode);
  const colorOverrides = useAppStore((s) => s.colorOverrides);
  const bom = useBom();
  const total = useCartTotal(bom);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  if (!model) {
    return <UploadStep />;
  }

  const selectedNode = model.nodes.find((n) => n.id === selectedNodeId) ?? model.nodes[0];

  return (
    <div className="flex h-[100dvh] flex-col">
      <TopBar />
      {/* Образец показывается, только если ключ вендора не задан. Без явной
          пометки человек, загрузивший свои фото, принял бы типовой дом за
          свой и заказал по нему смету. */}
      {model.source === "demo" && (
        <div
          role="status"
          className="flex shrink-0 items-center justify-center gap-2 border-b border-[var(--plate-edge)] px-4 py-2 text-center text-body-s"
          style={{ background: "rgba(216,189,122,0.10)", color: "var(--warning)" }}
        >
          <span aria-hidden="true">▲</span>
          Это образец, а не ваш дом: сервис 3D-реконструкции ещё не подключён.
        </div>
      )}
      {model.source === "photos" && <VendorNotice />}
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <EditorCanvas
            model={model}
            selectedNodeId={selectedNode.id}
            colorOverrides={colorOverrides}
            onSelect={selectNode}
            interactive
          />
          <Toolbar model={model} selectedNodeId={selectedNode.id} onSelectKind={selectNode} />

          {/* The штамп, now carrying the reader's own house. Same block as the
              landing page; there it described a sample, here it is live and
              re-reads on every change to the model. Inert to the pointer so it
              never intercepts a drag meant for the camera, and cleared above
              the surface toolbar, which is pinned to bottom-6 and centred —
              at bottom-4 the two collided over the last chip. */}
          <TitleBlock
            className="pointer-events-none absolute bottom-24 right-4 hidden w-[min(30rem,calc(100%-2rem))] backdrop-blur-sm xl:grid"
            fields={[
              { label: "Объект", value: model.name },
              {
                label: "Габариты",
                value: `${model.dimensions.widthM.toLocaleString("ru-RU")} × ${model.dimensions.depthM.toLocaleString("ru-RU")} м`,
              },
              { label: "Этажность", value: `${model.floors} эт.` },
              {
                label: "Высота стен",
                value: `${model.dimensions.heightM.toLocaleString("ru-RU")} м`,
              },
              { label: "Смета", value: formatRub(total), accent: true },
              { label: "Масштаб", value: "1:100" },
            ]}
          />
        </div>

        {/* Desktop rail */}
        <aside className="hidden w-96 shrink-0 flex-col gap-8 overflow-y-auto border-l border-[var(--plate-edge)] bg-[var(--rail)] p-6 backdrop-blur-sm lg:flex">
          <FootprintControls model={model} />
          <HouseControls model={model} />
          <MaterialsPalette node={selectedNode} />
          <ColorPicker node={selectedNode} />
          {selectedNode.roof && <RoofControls node={selectedNode} />}
          <EducationCardPanel />
          <BomPanel />
        </aside>
      </div>

      {/* Mobile: view-and-color-only degrade */}
      <div className="border-t border-[var(--plate-edge)] bg-[var(--rail)] p-3 backdrop-blur-sm lg:hidden">
        <button
          type="button"
          onClick={() => setMobileSheetOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-full border border-[var(--plate-edge)] px-4 py-3 text-body-s font-medium text-white"
          aria-expanded={mobileSheetOpen}
        >
          <span>Габариты, цвет и материал — {selectedNode.label}</span>
          <span aria-hidden="true">{mobileSheetOpen ? "▾" : "▴"}</span>
        </button>
        {mobileSheetOpen && (
          <div className="mt-3 max-h-[45vh] space-y-6 overflow-y-auto">
            {/* Габариты нужны и здесь: без них с телефона нельзя посчитать
                смету по своему дому — она осталась бы сметой чужого. */}
            <FootprintControls model={model} />
            <ColorPicker node={selectedNode} compact />
            <MaterialsPalette node={selectedNode} compact />
          </div>
        )}
      </div>
    </div>
  );
}
