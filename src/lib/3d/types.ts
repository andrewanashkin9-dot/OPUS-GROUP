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

export interface HouseConfig {
  floors: FloorCount;
  style: HouseStyle;
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

export interface SceneModel {
  id: string;
  name: string;
  createdAt: string;
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
