import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getModel3DProvider } from "./3d";
import { withRecalculatedQuantities } from "./3d/metrics";
import type {
  BomLine,
  FloorCount,
  HouseConfig,
  HouseStyle,
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
  /** True while the model is being rebuilt for new floors or a new style. */
  rebuilding: boolean;

  setTier: (tier: Tier) => void;
  generateFromPhotos: (photos: File[]) => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  applyMaterial: (nodeId: string, materialId: string) => Promise<void>;
  setColor: (nodeId: string, hex: string) => void;
  setRoofShape: (shape: RoofShape) => void;
  setRoofPitch: (pitchDeg: number) => void;
  setFloors: (floors: FloorCount) => Promise<void>;
  setStyle: (style: HouseStyle) => Promise<void>;
  resetProject: () => void;
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

type SetState = (
  partial: Partial<AppState> | ((state: AppState) => Partial<AppState>),
) => void;

/**
 * Rebuilds the model for a new storey count or style. Both change the
 * building itself, so manual quantity edits are dropped — they described a
 * house that no longer exists — and the geometry-derived numbers take over
 * again.
 */
async function reconfigure(
  set: SetState,
  config: HouseConfig,
  resetColors = false,
) {
  const provider = getModel3DProvider();
  if (!provider.reconfigure) {
    set({ error: "Этот способ построения не поддерживает смену этажности." });
    return;
  }
  set({ rebuilding: true, error: null });
  try {
    const model = await provider.reconfigure(config);
    set((state) => ({
      model,
      rebuilding: false,
      quantityOverrides: {},
      colorOverrides: resetColors ? {} : state.colorOverrides,
      selectedNodeId: model.nodes.some((n) => n.id === state.selectedNodeId)
        ? state.selectedNodeId
        : (model.nodes[0]?.id ?? null),
    }));
  } catch (err) {
    set({
      rebuilding: false,
      error:
        err instanceof Error ? err.message : "Не удалось перестроить модель.",
    });
  }
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
      rebuilding: false,

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

      resetProject: () =>
        set({
          model: null,
          status: "idle",
          error: null,
          selectedNodeId: null,
          quantityOverrides: {},
          colorOverrides: {},
        }),

      setFloors: async (floors) => {
        const { model } = get();
        if (!model || model.floors === floors) return;
        await reconfigure(set, { floors, style: model.style });
      },

      setStyle: async (style) => {
        const { model } = get();
        if (!model || model.style === style) return;
        // A style carries its own materials and colours, so any colour the
        // user had pinned on top of the previous style is cleared with it.
        await reconfigure(set, { floors: model.floors, style }, true);
      },

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
      // Bumped when the saved model's shape changes. A project saved before
      // storeys and styles existed has no floors to render and would restore
      // as a half-built house, so it is dropped rather than half-migrated.
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Partial<AppState> | undefined;
        if (!state) return state;
        if (version < 2) {
          return { ...state, model: null, selectedNodeId: null, status: "idle" };
        }
        return state;
      },
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
