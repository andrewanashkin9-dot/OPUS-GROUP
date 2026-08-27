import type { PlanPoint, RoomModel } from "./index";
import { roomCorners } from "./geometry";

/**
 * The furniture in the room.
 *
 * It is scenery, not a bill of materials: nothing here is priced, counted or
 * put in the cart, and none of it changes a single square metre of the
 * estimate. It exists because bare walls give the eye nothing to measure
 * 2,7 m against, and a room with a bed in it is a room.
 *
 * It is editable all the same. A layout you cannot move is a layout that is
 * wrong for your room and stays wrong — and the moment someone recognises
 * their own room in the picture, they trust the numbers next to it.
 */

export type FurnitureKind =
  | "bed"
  | "wardrobe"
  | "nightstand"
  | "desk"
  | "table"
  | "chair"
  | "vase"
  | "floor-lamp"
  | "pendant";

export interface FurnitureItem {
  id: string;
  kind: FurnitureKind;
  /** Which of the kind's variants this is. */
  variant: string;
  /** Position on the plan, in metres from the room's centre. */
  x: number;
  z: number;
  /** Quarter turns. Furniture goes against walls; nothing needs 7°. */
  rotationY: number;
}

export interface FurnitureVariant {
  id: string;
  label: string;
  /** Footprint in metres, before rotation. */
  widthM: number;
  depthM: number;
  heightM: number;
}

export interface FurnitureDef {
  kind: FurnitureKind;
  label: string;
  /** Fixed to the ceiling, so it is moved in plan but never lands on a wall. */
  ceiling?: boolean;
  variants: FurnitureVariant[];
}

export const FURNITURE: FurnitureDef[] = [
  {
    kind: "bed",
    label: "Кровать",
    variants: [
      { id: "double", label: "Двуспальная", widthM: 1.6, depthM: 2.0, heightM: 0.52 },
      { id: "single", label: "Односпальная", widthM: 0.9, depthM: 1.9, heightM: 0.5 },
    ],
  },
  {
    kind: "wardrobe",
    label: "Шкаф",
    variants: [
      { id: "hinged", label: "Распашной", widthM: 1.2, depthM: 0.6, heightM: 2.2 },
      { id: "sliding", label: "Купе", widthM: 1.8, depthM: 0.65, heightM: 2.4 },
    ],
  },
  {
    kind: "nightstand",
    label: "Тумба",
    variants: [
      { id: "drawers", label: "С ящиками", widthM: 0.44, depthM: 0.4, heightM: 0.5 },
      { id: "open", label: "Открытая", widthM: 0.44, depthM: 0.4, heightM: 0.55 },
    ],
  },
  {
    kind: "desk",
    label: "Стол рабочий",
    variants: [
      { id: "desk", label: "Письменный", widthM: 0.6, depthM: 1.4, heightM: 0.75 },
      { id: "counter", label: "Столешница", widthM: 0.6, depthM: 2.0, heightM: 0.9 },
    ],
  },
  {
    kind: "table",
    label: "Стол обеденный",
    variants: [
      { id: "rect", label: "Прямоугольный", widthM: 1.1, depthM: 0.72, heightM: 0.74 },
      { id: "round", label: "Круглый", widthM: 0.95, depthM: 0.95, heightM: 0.74 },
    ],
  },
  {
    kind: "chair",
    label: "Стул",
    variants: [
      { id: "wood", label: "Деревянный", widthM: 0.45, depthM: 0.45, heightM: 0.9 },
      { id: "soft", label: "С мягким сиденьем", widthM: 0.5, depthM: 0.5, heightM: 0.9 },
    ],
  },
  {
    kind: "vase",
    label: "Ваза",
    variants: [
      { id: "tall", label: "Высокая", widthM: 0.18, depthM: 0.18, heightM: 0.42 },
      { id: "low", label: "Низкая", widthM: 0.24, depthM: 0.24, heightM: 0.2 },
    ],
  },
  {
    kind: "floor-lamp",
    label: "Торшер",
    variants: [
      { id: "stem", label: "На стойке", widthM: 0.42, depthM: 0.42, heightM: 1.75 },
      { id: "tripod", label: "На треноге", widthM: 0.56, depthM: 0.56, heightM: 1.6 },
    ],
  },
  {
    kind: "pendant",
    label: "Люстра",
    ceiling: true,
    variants: [
      { id: "cone", label: "Конус", widthM: 0.48, depthM: 0.48, heightM: 0.3 },
      { id: "globe", label: "Шар", widthM: 0.34, depthM: 0.34, heightM: 0.34 },
    ],
  },
];

export function furnitureDef(kind: FurnitureKind): FurnitureDef {
  const found = FURNITURE.find((f) => f.kind === kind);
  if (!found) throw new Error(`Unknown furniture kind: ${kind}`);
  return found;
}

export function furnitureVariant(
  kind: FurnitureKind,
  variantId: string,
): FurnitureVariant {
  const def = furnitureDef(kind);
  return def.variants.find((v) => v.id === variantId) ?? def.variants[0];
}

/** Footprint after the item's quarter turn, which swaps width and depth. */
export function footprint(item: FurnitureItem): { widthM: number; depthM: number } {
  const variant = furnitureVariant(item.kind, item.variant);
  const turned = Math.round(Math.abs(item.rotationY) / (Math.PI / 2)) % 2 === 1;
  return turned
    ? { widthM: variant.depthM, depthM: variant.widthM }
    : { widthM: variant.widthM, depthM: variant.depthM };
}

/** Clearance from the wall: skirting, and room to get a hand behind it. */
const WALL_GAP_M = 0.04;

/**
 * Pulls a position back inside the room.
 *
 * Point-in-polygon would be the general answer, but furniture is rectangular
 * and rooms here are axis-aligned, so the honest test is whether the piece's
 * whole footprint is inside: the bounding rectangle first, then the notch of
 * an L-shape, which is the only piece of the bounding rectangle that is not
 * floor.
 */
export function clampToRoom(
  room: RoomModel,
  item: FurnitureItem,
  x: number,
  z: number,
): PlanPoint {
  const { widthM, depthM } = footprint(item);
  const limitX = Math.max(0, room.dimensions.widthM / 2 - widthM / 2 - WALL_GAP_M);
  const limitZ = Math.max(0, room.dimensions.lengthM / 2 - depthM / 2 - WALL_GAP_M);

  let nx = Math.min(limitX, Math.max(-limitX, x));
  let nz = Math.min(limitZ, Math.max(-limitZ, z));

  const notch = notchRect(room);
  if (notch) {
    // Overlapping the missing corner: push out along whichever axis needs the
    // smaller shove, which is what a hand pushing furniture would do.
    const overlapX =
      nx + widthM / 2 > notch.x0 && nx - widthM / 2 < notch.x1;
    const overlapZ =
      nz + depthM / 2 > notch.z0 && nz - depthM / 2 < notch.z1;
    if (overlapX && overlapZ) {
      const outX =
        notch.x0 > -room.dimensions.widthM / 2
          ? notch.x0 - widthM / 2 // notch on the +X side, so retreat to -X
          : notch.x1 + widthM / 2;
      const outZ =
        notch.z0 > -room.dimensions.lengthM / 2
          ? notch.z0 - depthM / 2
          : notch.z1 + depthM / 2;
      if (Math.abs(outX - nx) <= Math.abs(outZ - nz)) {
        nx = Math.min(limitX, Math.max(-limitX, outX));
      } else {
        nz = Math.min(limitZ, Math.max(-limitZ, outZ));
      }
    }
  }

  return { x: round(nx), z: round(nz) };
}

function notchRect(
  room: RoomModel,
): { x0: number; x1: number; z0: number; z1: number } | null {
  if (room.shape !== "l" || !room.notch) return null;
  const { corner, widthM: nw, lengthM: nl } = room.notch;
  const x0 =
    corner === "nw" || corner === "sw"
      ? -room.dimensions.widthM / 2
      : room.dimensions.widthM / 2 - nw;
  const z0 =
    corner === "nw" || corner === "ne"
      ? -room.dimensions.lengthM / 2
      : room.dimensions.lengthM / 2 - nl;
  return { x0, x1: x0 + nw, z0, z1: z0 + nl };
}

/** True when the whole footprint sits on floor that exists. */
export function fitsInRoom(room: RoomModel, item: FurnitureItem): boolean {
  const placed = clampToRoom(room, item, item.x, item.z);
  return Math.abs(placed.x - item.x) < 0.02 && Math.abs(placed.z - item.z) < 0.02;
}

/**
 * The layout a new room starts with.
 *
 * A bedroom, because that is the room people measure first, and because the
 * pieces in one span the whole range of sizes: a wardrobe reads the height, a
 * bed reads the floor, a nightstand reads the difference between 10 cm and
 * 40 cm. Anything that will not fit is simply left out rather than crammed in
 * — a 2 m² room gets a lamp and a pendant, and that is the honest answer.
 */
export function defaultLayout(room: RoomModel): FurnitureItem[] {
  const halfX = room.dimensions.widthM / 2;
  const halfZ = room.dimensions.lengthM / 2;

  const seed: Omit<FurnitureItem, "id">[] = [
    { kind: "bed", variant: "double", x: -halfX + 0.84, z: -halfZ + 1.04, rotationY: 0 },
    { kind: "nightstand", variant: "drawers", x: -halfX + 1.9, z: -halfZ + 0.24, rotationY: 0 },
    { kind: "wardrobe", variant: "hinged", x: halfX - 0.64, z: -halfZ + 0.34, rotationY: 0 },
    { kind: "desk", variant: "desk", x: halfX - 0.34, z: 0.2, rotationY: 0 },
    { kind: "table", variant: "rect", x: -0.2, z: halfZ - 0.95, rotationY: 0 },
    { kind: "chair", variant: "wood", x: -0.2, z: halfZ - 1.6, rotationY: 0 },
    { kind: "chair", variant: "wood", x: -0.2, z: halfZ - 0.3, rotationY: Math.PI },
    { kind: "vase", variant: "tall", x: -0.2, z: halfZ - 0.95, rotationY: 0 },
    { kind: "floor-lamp", variant: "stem", x: -halfX + 0.36, z: halfZ - 0.36, rotationY: 0 },
    { kind: "pendant", variant: "cone", x: 0, z: 0, rotationY: 0 },
  ];

  return seed
    .map((item, i) => ({ ...item, id: `f${i}` }))
    .filter((item) => item.kind === "pendant" || fitsInRoom(room, item));
}

/** Whether two pieces' footprints overlap on the plan. */
export function overlaps(a: FurnitureItem, b: FurnitureItem): boolean {
  // A pendant hangs above head height; nothing on the floor collides with it.
  if (a.kind === "pendant" || b.kind === "pendant") return false;
  const fa = footprint(a);
  const fb = footprint(b);
  return (
    Math.abs(a.x - b.x) < (fa.widthM + fb.widthM) / 2 - 0.05 &&
    Math.abs(a.z - b.z) < (fa.depthM + fb.depthM) / 2 - 0.05
  );
}

/**
 * A clear spot for a piece, spiralling out from where it wants to be.
 *
 * Used both for something newly added — which wants the middle — and for
 * something a resized room has just shoved, which wants to stay as close to
 * where it was as it can. Not a packing solver: it gives up after a short
 * search and puts the piece down anyway, because a wardrobe overlapping a
 * desk is a nuisance and an infinite loop is not.
 */
export function freeSpot(
  room: RoomModel,
  item: FurnitureItem,
  existing: FurnitureItem[],
  from?: PlanPoint,
): PlanPoint {
  const corners = roomCorners(room);
  const centre =
    from ??
    corners.reduce(
      (acc, c) => ({ x: acc.x + c.x / corners.length, z: acc.z + c.z / corners.length }),
      { x: 0, z: 0 },
    );

  // A short outward spiral, which finds a gap in a crowded room without
  // needing to solve packing.
  for (let step = 0; step < 40; step++) {
    const angle = step * 2.4;
    const radius = step * 0.18;
    const spot = clampToRoom(
      room,
      item,
      centre.x + Math.cos(angle) * radius,
      centre.z + Math.sin(angle) * radius,
    );
    const placed = { ...item, x: spot.x, z: spot.z };
    const clear = existing.every((other) => !overlaps(placed, other));
    if (clear) return spot;
  }
  return clampToRoom(room, item, centre.x, centre.z);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
