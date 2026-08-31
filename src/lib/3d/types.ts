export type NodeKind =
  | "roof"
  | "facade"
  | "fence"
  | "foundation"
  | "window"
  | "door";

export type Unit = "m2" | "m" | "pcs";

export type Tier = "free" | "pro";

export type RoofShape = "gable" | "hip" | "flat" | "mansard";

/** Private houses are built in whole storeys, so the model offers only these. */
export type FloorCount = 1 | 2 | 3;

export const FLOOR_COUNTS: FloorCount[] = [1, 2, 3];

/** Height of one storey, floor to floor. */
export const FLOOR_HEIGHT_M = 3;

export type HouseStyle =
  | "barnhouse"
  | "european"
  | "scandi"
  | "hightech"
  | "classic";

/** Пятно застройки в плане: то, что человек меряет рулеткой по фундаменту. */
export interface Footprint {
  widthM: number;
  depthM: number;
}

/**
 * Габариты по умолчанию — с них начинается любой проект, дальше их правит
 * человек. Раньше это число было зашито в провайдер и не менялось вовсе:
 * смета считалась по дому 9,5 × 8,2 независимо от того, чей это дом.
 */
export const DEFAULT_FOOTPRINT: Footprint = { widthM: 9.5, depthM: 8.2 };

/**
 * Границы, в которых величина остаётся частным домом.
 *
 * Ниже четырёх метров это сарай, выше тридцати — не тот продукт: смета,
 * материалы и бригады в каталоге рассчитаны на частную застройку. Пределы
 * нужны и технически — площадь входит в цену линейно, и опечатка в поле
 * ширины иначе превращает смету в миллионы.
 */
export const HOUSE_SIDE_MIN_M = 4;
export const HOUSE_SIDE_MAX_M = 30;

export interface HouseConfig {
  floors: FloorCount;
  style: HouseStyle;
  footprint: Footprint;
}

/**
 * Real roofs overhang the walls — the eaves throw rainwater clear of the
 * facade instead of down it. Anything less than this reads as a modelling
 * error to anyone who has actually built a house.
 */
export const MIN_ROOF_OVERHANG_M = 1;

export interface RoofGeometry {
  shape: RoofShape;
  pitchDeg: number;
  /** Distance the eaves project past the wall face, on every side. */
  overhangM: number;
}

export type Facade = "front" | "back" | "left" | "right";

/** A window or door cut into one facade, positioned in metres. */
export interface Opening {
  id: string;
  kind: "window" | "door";
  facade: Facade;
  /** Offset from the centre of that facade, along its width. */
  offsetM: number;
  /** Height of the opening's sill above the floor slab. */
  sillM: number;
  widthM: number;
  heightM: number;
}

export interface SceneNode {
  id: string;
  label: string;
  kind: NodeKind;
  materialId: string;
  quantity: number;
  unit: Unit;
  colorHex: string;
  roof?: RoofGeometry;
}

/**
 * Откуда взялась модель.
 *
 * "photos" — реконструкция дома пользователя. "demo" — образец, который
 * показывается только когда ключ вендора не задан. Различать обязательно:
 * без этого человек, загрузивший свои фото, может принять типовой дом за
 * свой и заказать по нему смету.
 */
export type ModelSource = "photos" | "demo";

export interface SceneModel {
  id: string;
  name: string;
  createdAt: string;
  source: ModelSource;
  sourcePhotoCount: number;
  /** `heightM` is the wall height to the eaves — always floors × FLOOR_HEIGHT_M. */
  dimensions: { widthM: number; depthM: number; heightM: number };
  floors: FloorCount;
  style: HouseStyle;
  nodes: SceneNode[];
  openings: Opening[];
}

export interface MaterialOption {
  id: string;
  nodeKind: NodeKind;
  name: string;
  description: string;
  pricePerUnit: number;
  unit: Unit;
  colorHex: string;
  textureId: TextureId;
  tier: Tier;
}

export type TextureId =
  | "brick-running"
  | "brick-clinker"
  | "brick-aged"
  | "block"
  | "plaster"
  | "planken"
  | "panel"
  | "tile-metal"
  | "tile-shingle"
  | "tile-wave"
  | "seam"
  | "profnastil"
  | "shtaketnik"
  | "forged"
  | "concrete"
  | "glass"
  | "wood-door"
  | "steel-door";

export interface BomLine {
  id: string;
  nodeId: string;
  nodeLabel: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unit: Unit;
  pricePerUnit: number;
  total: number;
}

export interface EducationCard {
  id: string;
  nodeKind: NodeKind;
  tag: string;
  title: string;
  body: string;
}
