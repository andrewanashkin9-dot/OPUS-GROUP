export type NodeKind = "roof" | "facade" | "fence" | "foundation" | "window";

export type Unit = "m2" | "m" | "pcs";

export type Tier = "free" | "pro";

export interface RoofGeometry {
  shape: "gable" | "hip" | "flat" | "mansard";
  pitchDeg: number;
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
  dimensions: { widthM: number; depthM: number; heightM: number };
  nodes: SceneNode[];
}

export interface MaterialOption {
  id: string;
  nodeKind: NodeKind;
  name: string;
  description: string;
  pricePerUnit: number;
  unit: Unit;
  colorHex: string;
  tier: Tier;
}

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
