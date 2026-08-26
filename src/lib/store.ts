import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getModel3DProvider } from "./3d";
import { withRecalculatedQuantities } from "./3d/metrics";
import { productById, type MarketUnit, type Product } from "./marketplace";
import {
  DEFAULT_DOOR,
  DEFAULT_ROOM_DIMENSIONS,
  DEFAULT_WASTE_PCT,
  DEFAULT_WINDOW,
  ROOM_LIMITS,
  reflowOpenings,
  roomCartAdditions,
  roomEstimate,
  roomSurfaces,
  suggestOffsetM,
  validateDimensions,
  validateOpening,
  type OpeningKind,
  type RoomDimensions,
  type RoomEstimate,
  type RoomModel,
  type RoomNotch,
  type RoomOpening,
  type RoomShape,
  type RoomSurface,
  type SurfaceId,
} from "./room";
import {
  getUsageLimitBackend,
  readUsage,
  usageSnapshot,
  type UsageSnapshot,
} from "./usage";
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

/** Шаги конфигуратора комнаты, в том порядке, в каком их проходят. */
export type RoomStep = "size" | "openings" | "finish" | "estimate";

export const ROOM_STEPS: { id: RoomStep; label: string }[] = [
  { id: "size", label: "Размеры" },
  { id: "openings", label: "Проёмы" },
  { id: "finish", label: "Отделка" },
  { id: "estimate", label: "Расчёт" },
];

/**
 * Фотография комнаты как подсказка самому себе.
 *
 * Живёт только в этой вкладке и только в памяти: никуда не отправляется и
 * не сохраняется. Обещание «фото остаются у вас» стоит ровно столько,
 * сколько стоит отсутствие кода, который их куда-то кладёт.
 */
export interface RoomPhoto {
  id: string;
  name: string;
  url: string;
}

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
  /**
   * Products added from the market, by id. They share the cart with the
   * model's own bill of materials: one basket, one total, one delivery — the
   * reader is buying for one building, not shopping in two places.
   */
  marketItems: Record<string, number>;

  // ------------------------------------------------------------ комната
  room: RoomModel | null;
  roomStep: RoomStep;
  /** Выбранная поверхность: она же подсвечена в 3D и открыта в панели. */
  selectedSurfaceId: SurfaceId | null;
  /** Камера внутри комнаты, а не снаружи в «кукольном домике». */
  insideView: boolean;
  roomError: string | null;
  roomPhotos: RoomPhoto[];
  /** Сколько проектов уже занято. null — ещё не спрашивали. */
  usage: UsageSnapshot | null;

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
  addMarketItem: (productId: string, quantity: number) => void;
  setMarketQuantity: (productId: string, quantity: number) => void;
  removeMarketItem: (productId: string) => void;

  refreshUsage: () => Promise<void>;
  /** Возвращает false, если свободный тариф уже исчерпан. */
  createRoom: () => Promise<boolean>;
  setRoomStep: (step: RoomStep) => void;
  setRoomDimensions: (patch: Partial<RoomDimensions>) => void;
  setRoomShape: (shape: RoomShape) => void;
  setRoomNotch: (patch: Partial<RoomNotch>) => void;
  addOpening: (kind: OpeningKind, wall: SurfaceId) => void;
  updateOpening: (id: string, patch: Partial<RoomOpening>) => void;
  removeOpening: (id: string) => void;
  selectSurface: (id: SurfaceId | null) => void;
  setInsideView: (inside: boolean) => void;
  setFinish: (surfaceId: SurfaceId, productId: string | null) => void;
  /** Один материал на все стены сразу — так их и выбирают в жизни. */
  setWallFinish: (productId: string) => void;
  setWastePct: (pct: number) => void;
  addRoomPhotos: (files: File[]) => void;
  removeRoomPhoto: (id: string) => void;
  addRoomToCart: () => void;
  resetRoom: () => Promise<void>;
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

/** A copy of `items` without `key`. */
function without(
  items: Record<string, number>,
  key: string,
): Record<string, number> {
  const next = { ...items };
  delete next[key];
  return next;
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
      marketItems: {},

      room: null,
      roomStep: "size",
      selectedSurfaceId: null,
      insideView: false,
      roomError: null,
      roomPhotos: [],
      usage: null,

      setTier: (tier) =>
        set((state) => ({
          tier,
          usage: state.usage ? usageSnapshot(state.usage.used, tier) : null,
        })),

      generateFromPhotos: async (photos) => {
        // Дом и комната делят один лимит: это два способа описать один
        // ремонт, а не два разных продукта.
        const allowance = await readUsage(get().tier);
        if (!allowance.allowed) {
          set({
            usage: allowance,
            status: "error",
            error:
              "На свободном тарифе доступно три проекта. Удалите один, чтобы начать новый.",
          });
          return;
        }
        set({ status: "generating", error: null });
        try {
          const model = await getModel3DProvider().generateFromPhotos(photos);
          await getUsageLimitBackend().add(model.id);
          set({
            model,
            status: "ready",
            selectedNodeId: model.nodes[0]?.id ?? null,
            usage: await readUsage(get().tier),
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

      resetProject: () => {
        const { model, tier } = get();
        // Удалённый проект освобождает место в лимите. Иначе три попытки
        // разобраться в интерфейсе навсегда закрывали бы свободный тариф.
        if (model) {
          void getUsageLimitBackend()
            .remove(model.id)
            .then(async () => set({ usage: await readUsage(tier) }));
        }
        set({
          model: null,
          status: "idle",
          error: null,
          selectedNodeId: null,
          quantityOverrides: {},
          colorOverrides: {},
        });
      },

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

      addMarketItem: (productId, quantity) =>
        set((state) => ({
          marketItems: {
            ...state.marketItems,
            [productId]: (state.marketItems[productId] ?? 0) + Math.max(1, quantity),
          },
        })),

      setMarketQuantity: (productId, quantity) =>
        set((state) => {
          // Counting a line down to zero removes it. Leaving a 0 × line in
          // the cart is a row the reader has to tidy up by hand.
          if (quantity <= 0) {
            return { marketItems: without(state.marketItems, productId) };
          }
          return {
            marketItems: { ...state.marketItems, [productId]: quantity },
          };
        }),

      removeMarketItem: (productId) =>
        set((state) => ({ marketItems: without(state.marketItems, productId) })),

      // ---------------------------------------------------------- комната

      refreshUsage: async () => {
        set({ usage: await readUsage(get().tier) });
      },

      createRoom: async () => {
        // Уже начатая комната — это тот же проект, а не новый: возврат на
        // экран выбора не должен съедать ещё одно место в лимите.
        if (get().room) return true;

        const allowance = await readUsage(get().tier);
        if (!allowance.allowed) {
          set({
            usage: allowance,
            roomError:
              "На свободном тарифе доступно три проекта. Удалите один, чтобы начать новый.",
          });
          return false;
        }

        const id = `room-${Date.now().toString(36)}`;
        await getUsageLimitBackend().add(id);
        set({
          room: {
            id,
            name: "Комната",
            createdAt: new Date().toISOString(),
            shape: "rect",
            dimensions: { ...DEFAULT_ROOM_DIMENSIONS },
            openings: [],
            finishes: {},
            wastePct: DEFAULT_WASTE_PCT,
          },
          roomStep: "size",
          selectedSurfaceId: "floor",
          insideView: false,
          roomError: null,
          usage: await readUsage(get().tier),
        });
        return true;
      },

      setRoomStep: (roomStep) => set({ roomStep }),

      setRoomDimensions: (patch) =>
        set((state) => {
          if (!state.room) return {};
          const dimensions = { ...state.room.dimensions };
          for (const key of ["widthM", "lengthM", "heightM"] as const) {
            const value = patch[key];
            if (value === undefined) continue;
            const limit = ROOM_LIMITS[key];
            // Обрезка по границам живёт здесь, а черновик ввода — в поле:
            // иначе набранная «1» в поле ширины прыгала бы к минимуму и
            // дописать «12» стало бы невозможно.
            dimensions[key] = Number.isFinite(value)
              ? Math.min(limit.max, Math.max(limit.min, value))
              : dimensions[key];
          }
          const room = { ...state.room, dimensions };
          return {
            room: { ...room, openings: reflowOpenings(room) },
            roomError: validateDimensions(room),
          };
        }),

      setRoomShape: (shape) =>
        set((state) => {
          if (!state.room || state.room.shape === shape) return {};
          const { widthM, lengthM } = state.room.dimensions;
          const room: RoomModel =
            shape === "l"
              ? {
                  ...state.room,
                  shape,
                  notch: {
                    corner: "ne",
                    widthM: Math.min(1.2, widthM - 1),
                    lengthM: Math.min(1, lengthM - 1),
                  },
                }
              : { ...state.room, shape, notch: undefined };
          return {
            room: { ...room, openings: reflowOpenings(room) },
            // Стен стало больше или меньше, и прежний выбор мог указывать на
            // стену, которой уже нет.
            selectedSurfaceId: "floor",
            roomError: validateDimensions(room),
          };
        }),

      setRoomNotch: (patch) =>
        set((state) => {
          if (!state.room?.notch) return {};
          const room: RoomModel = {
            ...state.room,
            notch: { ...state.room.notch, ...patch },
          };
          return {
            room: { ...room, openings: reflowOpenings(room) },
            roomError: validateDimensions(room),
          };
        }),

      addOpening: (kind, wall) =>
        set((state) => {
          if (!state.room) return {};
          const preset = kind === "door" ? DEFAULT_DOOR : DEFAULT_WINDOW;
          const offsetM = suggestOffsetM(state.room, wall, preset.widthM);
          if (offsetM === null) {
            return { roomError: "На этой стене не осталось места для проёма." };
          }
          const opening: RoomOpening = {
            id: `op-${Date.now().toString(36)}-${state.room.openings.length}`,
            kind,
            wall,
            offsetM,
            ...preset,
          };
          return {
            room: { ...state.room, openings: [...state.room.openings, opening] },
            selectedSurfaceId: wall,
            roomError: null,
          };
        }),

      updateOpening: (id, patch) =>
        set((state) => {
          if (!state.room) return {};
          const openings = state.room.openings.map((o) =>
            o.id === id ? { ...o, ...patch } : o,
          );
          const room = { ...state.room, openings };
          const edited = openings.find((o) => o.id === id);
          // Правка применяется всегда, даже неудачная: подменённое за спиной
          // значение читается как сломанный ползунок. Ошибка показывается
          // рядом с проёмом, а перейти к расчёту с ней не дадут.
          return { room, roomError: edited ? validateOpening(room, edited) : null };
        }),

      removeOpening: (id) =>
        set((state) => {
          if (!state.room) return {};
          return {
            room: {
              ...state.room,
              openings: state.room.openings.filter((o) => o.id !== id),
            },
            roomError: null,
          };
        }),

      selectSurface: (selectedSurfaceId) => set({ selectedSurfaceId }),

      setInsideView: (insideView) => set({ insideView }),

      setFinish: (surfaceId, productId) =>
        set((state) => {
          if (!state.room) return {};
          const finishes = { ...state.room.finishes };
          if (productId) finishes[surfaceId] = productId;
          else delete finishes[surfaceId];
          return { room: { ...state.room, finishes } };
        }),

      setWallFinish: (productId) =>
        set((state) => {
          if (!state.room) return {};
          const finishes = { ...state.room.finishes };
          for (const surface of roomSurfaces(state.room)) {
            if (surface.kind === "wall") finishes[surface.id] = productId;
          }
          return { room: { ...state.room, finishes } };
        }),

      setWastePct: (pct) =>
        set((state) => {
          if (!state.room) return {};
          const { min, max } = ROOM_LIMITS.wastePct;
          return {
            room: {
              ...state.room,
              wastePct: Math.min(max, Math.max(min, Math.round(pct))),
            },
          };
        }),

      addRoomPhotos: (files) =>
        set((state) => ({
          roomPhotos: [
            ...state.roomPhotos,
            ...files.map((file, i) => ({
              id: `photo-${Date.now().toString(36)}-${i}`,
              name: file.name,
              url: URL.createObjectURL(file),
            })),
          ],
        })),

      removeRoomPhoto: (id) =>
        set((state) => {
          const photo = state.roomPhotos.find((p) => p.id === id);
          if (photo) URL.revokeObjectURL(photo.url);
          return { roomPhotos: state.roomPhotos.filter((p) => p.id !== id) };
        }),

      addRoomToCart: () =>
        set((state) => {
          if (!state.room) return {};
          // Количества назначаются, а не прибавляются: кнопку нажимают по
          // второму разу, чтобы обновить расчёт после правки, а не чтобы
          // купить всё дважды.
          return {
            marketItems: {
              ...state.marketItems,
              ...roomCartAdditions(state.room),
            },
          };
        }),

      resetRoom: async () => {
        const { room, roomPhotos, tier } = get();
        for (const photo of roomPhotos) URL.revokeObjectURL(photo.url);
        if (room) await getUsageLimitBackend().remove(room.id);
        set({
          room: null,
          roomStep: "size",
          selectedSurfaceId: null,
          insideView: false,
          roomError: null,
          roomPhotos: [],
          usage: await readUsage(tier),
        });
      },
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
        marketItems: state.marketItems,
        room: state.room,
        roomStep: state.roomStep,
        selectedSurfaceId: state.selectedSurfaceId,
        // roomPhotos сознательно не сохраняются: они живут только в этой
        // вкладке, и обещание «фото остаются у вас» держится именно тем,
        // что их некуда записать.
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

/** One line of the market half of the cart. */
export interface MarketLine {
  product: Product;
  quantity: number;
  unit: MarketUnit;
  total: number;
}

/**
 * Market lines, memoized for the same reason as useBom: derived from state
 * rather than held in it, so computing them inline as a selector would hand
 * zustand a new array on every render.
 */
export function useMarketLines(): MarketLine[] {
  const marketItems = useAppStore((s) => s.marketItems);

  return useMemo(
    () =>
      Object.entries(marketItems)
        .map(([id, quantity]) => {
          const product = productById(id);
          // A product can disappear from the catalogue between visits; a
          // stale id in a restored cart must not crash the page.
          if (!product) return null;
          return {
            product,
            quantity,
            unit: product.unit,
            total: Math.round(product.price * quantity),
          };
        })
        .filter((line): line is MarketLine => line !== null),
    [marketItems],
  );
}

export function useMarketTotal(lines: MarketLine[]): number {
  return useMemo(() => lines.reduce((sum, line) => sum + line.total, 0), [lines]);
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

/**
 * The room's estimate, memoized for the same reason as useBom: it is derived
 * from the model rather than held in state, so computing it inline as a
 * selector would hand zustand a new object on every render.
 */
export function useRoomEstimate(): RoomEstimate | null {
  const room = useAppStore((s) => s.room);
  return useMemo(() => (room ? roomEstimate(room) : null), [room]);
}

/** The room's surfaces, in the order they are worked through. */
export function useRoomSurfaces(): RoomSurface[] {
  const room = useAppStore((s) => s.room);
  return useMemo(() => (room ? roomSurfaces(room) : []), [room]);
}

/**
 * How much of the free tier is left.
 *
 * Read on mount rather than persisted with the project: the count lives
 * behind the UsageLimit seam, and once that seam is a server call this hook
 * is the only place that has to keep working — not every screen that shows
 * the number.
 */
export function useUsage(): UsageSnapshot | null {
  const usage = useAppStore((s) => s.usage);
  const refreshUsage = useAppStore((s) => s.refreshUsage);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  return usage;
}
