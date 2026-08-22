"use client";

import { useState } from "react";
import { StageApproach } from "@/components/stage/StageApproach";
import { useAppStore } from "@/lib/store";
import { BomPanel } from "./BomPanel";
import { ColorPicker } from "./ColorPicker";
import { EditorCanvas } from "./EditorCanvas";
import { EducationCardPanel } from "./EducationCardPanel";
import { HouseControls } from "./HouseControls";
import { MaterialsPalette } from "./MaterialsPalette";
import { RoofControls } from "./RoofControls";
import { Toolbar } from "./Toolbar";
import { TopBar } from "./TopBar";
import { UploadStep } from "./UploadStep";

export function EditorShell() {
  const model = useAppStore((s) => s.model);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const selectNode = useAppStore((s) => s.selectNode);
  const colorOverrides = useAppStore((s) => s.colorOverrides);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  if (!model) {
    return <UploadStep />;
  }

  const selectedNode = model.nodes.find((n) => n.id === selectedNodeId) ?? model.nodes[0];

  return (
    <div className="flex h-[100dvh] flex-col">
      <StageApproach stage="design" />
      <TopBar />
      {/* Образец показывается, только если ключ вендора не задан. Без явной
          пометки человек, загрузивший свои фото, принял бы типовой дом за
          свой и заказал по нему смету. */}
      {model.source === "demo" && (
        <div
          role="status"
          className="flex shrink-0 items-center justify-center gap-2 border-b border-line px-4 py-2 text-center text-body-s"
          style={{ background: "rgba(194,160,90,0.12)", color: "var(--warning)" }}
        >
          <span aria-hidden="true">▲</span>
          Это образец, а не ваш дом: сервис 3D-реконструкции ещё не подключён.
        </div>
      )}
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
        </div>

        {/* Desktop rail */}
        <aside className="hidden w-96 shrink-0 flex-col gap-8 overflow-y-auto border-l border-line p-6 lg:flex">
          <HouseControls model={model} />
          <MaterialsPalette node={selectedNode} />
          <ColorPicker node={selectedNode} />
          {selectedNode.roof && <RoofControls node={selectedNode} />}
          <EducationCardPanel />
          <BomPanel />
        </aside>
      </div>

      {/* Mobile: view-and-color-only degrade */}
      <div className="border-t border-line p-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileSheetOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-full border border-line px-4 py-3 text-body-s font-medium"
          aria-expanded={mobileSheetOpen}
        >
          <span>Цвет и материал — {selectedNode.label}</span>
          <span aria-hidden="true">{mobileSheetOpen ? "▾" : "▴"}</span>
        </button>
        {mobileSheetOpen && (
          <div className="mt-3 max-h-[45vh] space-y-6 overflow-y-auto">
            <ColorPicker node={selectedNode} compact />
            <MaterialsPalette node={selectedNode} compact />
          </div>
        )}
      </div>
    </div>
  );
}
