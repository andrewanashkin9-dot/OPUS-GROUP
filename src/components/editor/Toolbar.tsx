"use client";

import type { NodeKind, SceneModel } from "@/lib/3d/types";
import { nodeKindLabel } from "@/lib/store";

const KIND_ORDER: NodeKind[] = [
  "roof",
  "facade",
  "window",
  "door",
  "fence",
  "foundation",
];

interface ToolbarProps {
  model: SceneModel;
  selectedNodeId: string | null;
  onSelectKind: (nodeId: string) => void;
}

export function Toolbar({ model, selectedNodeId, onSelectKind }: ToolbarProps) {
  const selectedNode = model.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface/95 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
        {KIND_ORDER.map((kind) => {
          const firstNode = model.nodes.find((n) => n.kind === kind);
          if (!firstNode) return null;
          const active = selectedNode?.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onSelectKind(firstNode.id)}
              className={`shrink-0 rounded-full px-3 py-2 text-body-s font-medium transition-colors sm:px-4 ${
                active
                  ? "bg-cream text-bg"
                  : "text-cream-dim hover:text-cream-bright"
              }`}
              aria-pressed={active}
            >
              {nodeKindLabel(kind)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
