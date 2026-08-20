"use client";

import { formatRub, formatUnit } from "@/lib/format";
import { useAppStore, useBom, useCartTotal } from "@/lib/store";

export function BomPanel() {
  const bom = useBom();
  const total = useCartTotal(bom);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const selectNode = useAppStore((s) => s.selectNode);

  return (
    <div>
      <h3 className="text-caption font-medium uppercase text-cream-dim">
        Смета — обновляется вживую
      </h3>
      <ul className="mt-3 divide-y divide-line">
        {bom.map((line) => (
          <li key={line.id}>
            <button
              type="button"
              onClick={() => selectNode(line.nodeId)}
              className={`flex w-full items-center justify-between gap-3 py-3 text-left transition-colors ${
                selectedNodeId === line.nodeId ? "text-cream-bright" : "text-cream"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-body-s font-medium">
                  {line.nodeLabel}
                </span>
                <span className="block truncate text-caption text-cream-dim">
                  {line.materialName} · {line.quantity} {formatUnit(line.unit)}
                </span>
              </span>
              <span className="shrink-0 text-body-s font-bold tabular-nums">
                {formatRub(line.total)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-4">
        <span className="text-body-s font-medium text-cream-dim">Итого материалы</span>
        <span className="text-h3 font-display font-medium tabular-nums text-cream-bright">
          {formatRub(total)}
        </span>
      </div>
    </div>
  );
}
