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
  clampToRoom,
  defaultLayout,
  freeSpot,
  furnitureDef,
  reflowOpenings,
  roomCartAdditions,
  roomEstimate,
  roomSurfaces,
  strandedOpenings,
  suggestOffsetM,
  validateDimensions,
  validateOpening,
  type FurnitureItem,
  type FurnitureKind,
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
  Footprint,
  HouseConfig,
  HouseStyle,
  NodeKind,
  RoofShape,
  SceneModel,
  SceneNode,
  Tier,
} from "./3d/types";
import { HOUSE_SIDE_MAX_M, HOUSE_SIDE_MIN_M } from "./3d/types";

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
  /** Выбранный предмет обстановки. Отдельно от поверхностей: это разные вещи. */
  selectedFurnitureId: string | null;
  /** Что сейчас тащат мышью. Пока не null, орбита камеры выключена. */
  draggingFurnitureId: string | null;
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
  /** Габариты дома в плане. Их задаёт человек — вендор их не измеряет. */
  setFootprint: (footprint: Footprint) => Promise<void>;
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

  selectFurniture: (id: string | null) => void;
  beginFurnitureDrag: (id: string) => void;
  endFurnitureDrag: () => void;
  moveFurniture: (id: string, x: number, z: number) => void;
  rotateFurniture: (id: string) => void;
  replaceFurniture: (id: string, variantId: string) => void;
  removeFurniture: (id: string) => void;
  addFurniture: (kind: FurnitureKind) => void;
  resetFurniture: () => void;
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
 * Параметры постройки, восстановленные из модели.
 *
 * Раньше каждый вызов собирал их вручную, и стоило добавить к постройке
 * ещё один параметр — габариты, — как забытое поле молча возвращало бы дом
 * к значению по умолчанию.
 */
function configOf(model: SceneModel): HouseConfig {
  return {
    floors: model.floors,
    style: model.style,
    footprint: {
      widthM: model.dimensions.widthM,
      depthM: model.dimensions.depthM,
    },
  };
}

/**
 * Число из поля ввода — это ещё не длина: там бывает пусто, «12,5», минус и
 * просто мусор. Отбрасываем всё, что не похоже на сторону частного дома, и
 * оставляем прежнее значение — молча подставленный ноль обнулил бы смету.
 */
function clampSide(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const clamped = Math.min(HOUSE_SIDE_MAX_M, Math.max(HOUSE_SIDE_MIN_M, value));
  return Math.round(clamped * 10) / 10;
}

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

/**
 * Keeps a notch inside the room it is cut out of.
 *
 * At least half a metre — below that it is a niche, not a plan — and never
 * closer than a metre to the opposite wall, which is where the remaining
 * strip of room stops being a room.
 */
function clampNotch(value: number, roomSideM: number): number {
  return Math.min(Math.max(0.5, value), Math.max(0.5, roomSideM - 1));
}

/**
 * What to say after a change that renumbers the walls.
 *
 * Cutting or moving a notch splits one wall into three and shifts every
 * number after it, so an opening can land on a wall it no longer fits. The
 * openings are not quietly deleted and not quietly resized — the reader is
 * told, and the estimate stays blocked until they decide what to do.
 */
function strandedNotice(model: RoomModel): string | null {
  const invalid = validateDimensions(model);
  if (invalid) return invalid;
  const stranded = strandedOpenings(model);
  if (!stranded.length) return null;
  return stranded.length === 1
    ? "Один проём больше не помещается в свою стену — поправьте его на шаге «Проёмы»."
    : `${stranded.length} проёма больше не помещаются в свои стены — поправьте их на шаге «Проёмы».`;
}

/**
 * Pulls every piece back inside a room that has just changed shape.
 *
 * Nothing is deleted. A wardrobe that no longer fits ends up against the
 * nearest wall it does fit against, which is where its owner would have
 * shoved it — and is recoverable, which a silent deletion is not.
 */
function reflowFurniture(room: RoomModel): FurnitureItem[] {
  const clamped = room.furniture.map((item) => {
    const spot = clampToRoom(room, item, item.x, item.z);
    return spot.x === item.x && spot.z === item.z
      ? item
      : { ...item, x: spot.x, z: spot.z };
  });

  // Only the pieces that actually had to move are parted from their
  // neighbours. Sweeping every overlap would pull the chairs away from the
  // table and take the vase off it — those overlaps are the arrangement.
  return clamped.map((item, i) => {
    if (item === room.furniture[i]) return item;
    const others = clamped.filter((_, j) => j !== i);
    const clear = freeSpot(room, item, others, { x: item.x, z: item.z });
    return { ...item, x: clear.x, z: clear.z };
  });
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
      selectedFurnitureId: null,
      draggingFurnitureId: null,
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

          // Здесь НЕ вызывается вендор, и это осознанно.
          //
          // Одна генерация у Neural4D стоит 120 баллов. Пока меш никуда не
          // выводится, каждая загрузка фотографий покупала бы картинку,
          // которую никто не увидит, — счёт растёт, польза нулевая. Вызов
          // вернётся сюда вместе с показом меша и ровно одним вариантом на
          // запрос, а не четырьмя.
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
        await reconfigure(set, { ...configOf(model), floors });
      },

      setStyle: async (style) => {
        const { model } = get();
        if (!model || model.style === style) return;
        // A style carries its own materials and colours, so any colour the
        // user had pinned on top of the previous style is cleared with it.
        await reconfigure(set, { ...configOf(model), style }, true);
      },

      setFootprint: async (footprint) => {
        const { model } = get();
        if (!model) return;
        const next = {
          widthM: clampSide(footprint.widthM, model.dimensions.widthM),
          depthM: clampSide(footprint.depthM, model.dimensions.depthM),
        };
        if (
          next.widthM === model.dimensions.widthM &&
          next.depthM === model.dimensions.depthM
        ) {
          return;
        }
        await reconfigure(set, { ...configOf(model), footprint: next });
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
        const room: RoomModel = {
          id,
          name: "Комната",
          createdAt: new Date().toISOString(),
          shape: "rect",
          dimensions: { ...DEFAULT_ROOM_DIMENSIONS },
          openings: [],
          finishes: {},
          furniture: [],
          wastePct: DEFAULT_WASTE_PCT,
        };
        set({
          room: { ...room, furniture: defaultLayout(room) },
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
          const room = { ...state.room, dimensions, notch: state.room.notch };
          if (room.notch) {
            // A notch wider than the room folds the plan polygon through
            // itself, and every area downstream of it becomes nonsense.
            room.notch = {
              ...room.notch,
              widthM: clampNotch(room.notch.widthM, dimensions.widthM),
              lengthM: clampNotch(room.notch.lengthM, dimensions.lengthM),
            };
          }
          return {
            room: {
              ...room,
              openings: reflowOpenings(room),
              furniture: reflowFurniture(room),
            },
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
          const next = {
            ...room,
            openings: reflowOpenings(room),
            furniture: reflowFurniture(room),
          };
          return {
            room: next,
            // Стен стало больше или меньше, и прежний выбор мог указывать на
            // стену, которой уже нет.
            selectedSurfaceId: "floor",
            roomError: strandedNotice(next),
          };
        }),

      setRoomNotch: (patch) =>
        set((state) => {
          if (!state.room?.notch) return {};
          const merged = { ...state.room.notch, ...patch };
          const room: RoomModel = {
            ...state.room,
            notch: {
              ...merged,
              widthM: clampNotch(merged.widthM, state.room.dimensions.widthM),
              lengthM: clampNotch(merged.lengthM, state.room.dimensions.lengthM),
            },
          };
          return {
            room: {
              ...room,
              openings: reflowOpenings(room),
              furniture: reflowFurniture(room),
            },
            // Moving the notch renumbers the walls around it, so an opening
            // can end up on a wall it no longer fits.
            roomError: strandedNotice(room),
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

      // Choosing a surface puts the furniture panel away: they are two
      // different things to be doing, and one of them is the estimate.
      selectSurface: (selectedSurfaceId) =>
        set({ selectedSurfaceId, selectedFurnitureId: null }),

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

      selectFurniture: (selectedFurnitureId) => set({ selectedFurnitureId }),

      beginFurnitureDrag: (id) =>
        set({ draggingFurnitureId: id, selectedFurnitureId: id }),

      endFurnitureDrag: () => set({ draggingFurnitureId: null }),

      moveFurniture: (id, x, z) =>
        set((state) => {
          if (!state.room) return {};
          const furniture = state.room.furniture.map((item) => {
            if (item.id !== id) return item;
            const spot = clampToRoom(state.room!, item, x, z);
            return { ...item, x: spot.x, z: spot.z };
          });
          return { room: { ...state.room, furniture } };
        }),

      rotateFurniture: (id) =>
        set((state) => {
          if (!state.room) return {};
          const room = state.room;
          const furniture = room.furniture.map((item) => {
            if (item.id !== id) return item;
            // A quarter turn swaps the footprint, so what fitted along a wall
            // may not fit across the room — re-clamp against the new one.
            const turned = {
              ...item,
              rotationY: (item.rotationY + Math.PI / 2) % (Math.PI * 2),
            };
            const spot = clampToRoom(room, turned, turned.x, turned.z);
            return { ...turned, x: spot.x, z: spot.z };
          });
          return { room: { ...room, furniture } };
        }),

      replaceFurniture: (id, variantId) =>
        set((state) => {
          if (!state.room) return {};
          const room = state.room;
          const furniture = room.furniture.map((item) => {
            if (item.id !== id) return item;
            const swapped = { ...item, variant: variantId };
            const spot = clampToRoom(room, swapped, swapped.x, swapped.z);
            return { ...swapped, x: spot.x, z: spot.z };
          });
          return { room: { ...room, furniture } };
        }),

      removeFurniture: (id) =>
        set((state) => {
          if (!state.room) return {};
          return {
            room: {
              ...state.room,
              furniture: state.room.furniture.filter((item) => item.id !== id),
            },
            selectedFurnitureId:
              state.selectedFurnitureId === id ? null : state.selectedFurnitureId,
          };
        }),

      addFurniture: (kind) =>
        set((state) => {
          if (!state.room) return {};
          const room = state.room;
          const def = furnitureDef(kind);
          const item: FurnitureItem = {
            id: `f-${Date.now().toString(36)}-${room.furniture.length}`,
            kind,
            variant: def.variants[0].id,
            x: 0,
            z: 0,
            rotationY: 0,
          };
          const spot = def.ceiling
            ? { x: 0, z: 0 }
            : freeSpot(room, item, room.furniture);
          const placed = { ...item, x: spot.x, z: spot.z };
          return {
            room: { ...room, furniture: [...room.furniture, placed] },
            selectedFurnitureId: placed.id,
          };
        }),

      resetFurniture: () =>
        set((state) => {
          if (!state.room) return {};
          return {
            room: { ...state.room, furniture: defaultLayout(state.room) },
            selectedFurnitureId: null,
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
          selectedFurnitureId: null,
          draggingFurnitureId: null,
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
        // A room saved before there was furniture has none, and every piece
        // of code downstream expects an array. Seeding beats a version bump
        // that would throw the reader's measurements away over scenery.
        if (state.room && !Array.isArray(state.room.furniture)) {
          state.room = {
            ...state.room,
            furniture: defaultLayout({ ...state.room, furniture: [] }),
          };
        }
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
