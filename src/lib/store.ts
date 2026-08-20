import { useMemo } from "react";
import { create } from "zustand";
import { getModel3DProvider } from "./3d";
import type { BomLine, NodeKind, SceneModel, Tier } from "./3d/types";

interface AppState {
  tier: Tier;
  model: SceneModel | null;
  status: "idle" | "generating" | "ready" | "error";
  error: string | null;
  selectedNodeId: string | null;
  activeEducationCardId: string | null;
  dismissedEducationCardIds: string[];
  quantityOverrides: Record<string, number>;

  setTier: (tier: Tier) => void;
  generateFromPhotos: (photos: File[]) => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  applyMaterial: (nodeId: string, materialId: string) => Promise<void>;
  showEducationCard: (cardId: string) => void;
  dismissEducationCard: (cardId: string) => void;
  setQuantity: (nodeId: string, quantity: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  tier: "free",
  model: null,
  status: "idle",
  error: null,
  selectedNodeId: null,
  activeEducationCardId: null,
  dismissedEducationCardIds: [],
  quantityOverrides: {},

  setTier: (tier) => set({ tier }),

  generateFromPhotos: async (photos) => {
    set({ status: "generating", error: null });
    try {
      const model = await getModel3DProvider().generateFromPhotos(photos);
      set({ model, status: "ready", selectedNodeId: model.nodes[0]?.id ?? null });
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : "Не удалось построить модель.",
      });
    }
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  applyMaterial: async (nodeId, materialId) => {
    const model = await getModel3DProvider().applyMaterial(nodeId, materialId);
    set({ model });
  },

  showEducationCard: (cardId) => {
    if (get().dismissedEducationCardIds.includes(cardId)) return;
    set({ activeEducationCardId: cardId });
  },

  dismissEducationCard: (cardId) =>
    set((state) => ({
      activeEducationCardId:
        state.activeEducationCardId === cardId ? null : state.activeEducationCardId,
      dismissedEducationCardIds: [...state.dismissedEducationCardIds, cardId],
    })),

  setQuantity: (nodeId, quantity) =>
    set((state) => ({
      quantityOverrides: { ...state.quantityOverrides, [nodeId]: Math.max(0, quantity) },
    })),
}));

/**
 * The bill of materials is derived from `model` + `quantityOverrides`, not
 * stored state — computing it inline as a zustand selector would allocate
 * a new array every render and trigger an infinite re-render loop. Memoize
 * it here instead.
 */
export function useBom(): BomLine[] {
  const model = useAppStore((s) => s.model);
  const quantityOverrides = useAppStore((s) => s.quantityOverrides);

  return useMemo(() => {
    if (!model) return [];
    return getModel3DProvider()
      .getBillOfMaterials(model)
      .map((line) => {
        const override = quantityOverrides[line.nodeId];
        if (override === undefined) return line;
        return {
          ...line,
          quantity: override,
          total: Math.round(line.pricePerUnit * override),
        };
      });
  }, [model, quantityOverrides]);
}

export function useCartTotal(bom: BomLine[]): number {
  return useMemo(() => bom.reduce((sum, line) => sum + line.total, 0), [bom]);
}

export function nodeKindLabel(kind: NodeKind): string {
  switch (kind) {
    case "roof":
      return "Крыша";
    case "facade":
      return "Фасад";
    case "fence":
      return "Забор";
    case "foundation":
      return "Фундамент";
    case "window":
      return "Окна";
  }
}
