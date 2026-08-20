import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getModel3DProvider } from "./3d";
import { withRecalculatedQuantities } from "./3d/metrics";
import type {
  BomLine,
  NodeKind,
  RoofShape,
  SceneModel,
  SceneNode,
  Tier,
} from "./3d/types";

interface AppState {
  tier: Tier;
  model: SceneModel | null;
  status: "idle" | "generating" | "ready" | "error";
  error: string | null;
  selectedNodeId: string | null;
  activeEducationCardId: string | null;
  dismissedEducationCardIds: string[];
  quantityOverrides: Record<string, number>;
  /** Per-node colour picked by the user, overriding the material's default. */
  colorOverrides: Record<string, string>;

  setTier: (tier: Tier) => void;
  generateFromPhotos: (photos: File[]) => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  applyMaterial: (nodeId: string, materialId: string) => Promise<void>;
  setColor: (nodeId: string, hex: string) => void;
  setRoofShape: (shape: RoofShape) => void;
  setRoofPitch: (pitchDeg: number) => void;
  showEducationCard: (cardId: string) => void;
  dismissEducationCard: (cardId: string) => void;
  setQuantity: (nodeId: string, quantity: number) => void;
}

/**
 * Roof edits change how much roof there is, so the geometry-derived
 * quantities are recomputed and the provider is re-seeded in the same step —
 * otherwise the estimate would keep quoting the previous roof.
 */
function updateRoof(
  mutate: (roof: NonNullable<SceneNode["roof"]>) => NonNullable<SceneNode["roof"]>,
) {
  return (state: AppState): Partial<AppState> => {
    if (!state.model) return {};
    const next = withRecalculatedQuantities({
      ...state.model,
      nodes: state.model.nodes.map((node) =>
        node.roof ? { ...node, roof: mutate(node.roof) } : node,
      ),
    });
    getModel3DProvider().adoptModel?.(next);
    return { model: next };
  };
}

/** The colour actually rendered: the user's pick, else the material default. */
export function effectiveColor(
  node: SceneNode,
  overrides: Record<string, string>,
): string {
  return overrides[node.id] ?? node.colorHex;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tier: "free",
      model: null,
      status: "idle",
      error: null,
      selectedNodeId: null,
      activeEducationCardId: null,
      dismissedEducationCardIds: [],
      quantityOverrides: {},
      colorOverrides: {},

      setTier: (tier) => set({ tier }),

      generateFromPhotos: async (photos) => {
        set({ status: "generating", error: null });
        try {
          const model = await getModel3DProvider().generateFromPhotos(photos);
          set({
            model,
            status: "ready",
            selectedNodeId: model.nodes[0]?.id ?? null,
          });
        } catch (err) {
          set({
            status: "error",
            error:
              err instanceof Error ? err.message : "Не удалось построить модель.",
          });
        }
      },

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

      applyMaterial: async (nodeId, materialId) => {
        try {
          const model = await getModel3DProvider().applyMaterial(nodeId, materialId);
          set({ model, error: null });
        } catch (err) {
          set({
            error:
              err instanceof Error
                ? err.message
                : "Не удалось применить материал.",
          });
        }
      },

      setColor: (nodeId, hex) =>
        set((state) => ({
          colorOverrides: { ...state.colorOverrides, [nodeId]: hex },
        })),

      setRoofShape: (shape) => set(updateRoof((roof) => ({ ...roof, shape }))),

      setRoofPitch: (pitchDeg) =>
        set(
          updateRoof((roof) => ({
            ...roof,
            pitchDeg: Math.min(60, Math.max(5, Math.round(pitchDeg))),
          })),
        ),

      showEducationCard: (cardId) => {
        if (get().dismissedEducationCardIds.includes(cardId)) return;
        set({ activeEducationCardId: cardId });
      },

      dismissEducationCard: (cardId) =>
        set((state) => ({
          activeEducationCardId:
            state.activeEducationCardId === cardId
              ? null
              : state.activeEducationCardId,
          dismissedEducationCardIds: [...state.dismissedEducationCardIds, cardId],
        })),

      setQuantity: (nodeId, quantity) =>
        set((state) => ({
          quantityOverrides: {
            ...state.quantityOverrides,
            [nodeId]: Math.max(0, quantity),
          },
        })),
    }),
    {
      name: "opus-group-project",
      storage: createJSONStorage(() => localStorage),
      // Hydration is deferred to useStoreHydration (below) so the server and
      // the first client render agree. Reading localStorage during store
      // creation would make them disagree and break hydration.
      skipHydration: true,
      partialize: (state) => ({
        tier: state.tier,
        model: state.model,
        status: state.status,
        selectedNodeId: state.selectedNodeId,
        quantityOverrides: state.quantityOverrides,
        colorOverrides: state.colorOverrides,
        dismissedEducationCardIds: state.dismissedEducationCardIds,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.model) {
          // A restored model never passed through generateFromPhotos, so the
          // provider holds no session for it and applyMaterial would throw.
          getModel3DProvider().adoptModel?.(state.model);
        } else if (state.status !== "idle") {
          // Reloading mid-generation would otherwise strand the user on a
          // "Строим 3D-модель…" screen that nothing will ever finish.
          state.status = "idle";
          state.error = null;
        }
      },
    },
  ),
);

/**
 * Replays persisted project state into the store after mount. Kept out of
 * store creation on purpose: hydrating during render would desync the
 * server-rendered HTML from the first client render.
 */
export function useStoreHydration() {
  useEffect(() => {
    void useAppStore.persist.rehydrate();
  }, []);
}

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
    case "door":
      return "Дверь";
  }
}
