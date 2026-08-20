import { materialById, materialsForKind } from "./materials";
import {
  facadeAreaM2,
  fenceLengthM,
  foundationAreaM2,
  roofAreaM2,
  withRecalculatedQuantities,
} from "./metrics";
import type { Model3DProvider } from "./provider";
import type { BomLine, Opening, SceneModel } from "./types";
import { MIN_ROOF_OVERHANG_M } from "./types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DIMENSIONS = { widthM: 9.5, depthM: 8.2, heightM: 6 };

const WINDOW_W = 1.2;
const WINDOW_H = 1.5;
const GROUND_SILL = 0.9;
const UPPER_SILL = 3.6;

/**
 * Nine windows and a front door, laid out the way a two-storey house
 * actually reads: paired ground-floor windows either side of the entrance,
 * a rhythm of three above it, and single openings on the flanks.
 */
const OPENINGS: Opening[] = [
  { id: "op-door", kind: "door", facade: "front", offsetM: 0, sillM: 0, widthM: 1.1, heightM: 2.1 },

  { id: "op-w-f1", kind: "window", facade: "front", offsetM: -2.6, sillM: GROUND_SILL, widthM: WINDOW_W, heightM: WINDOW_H },
  { id: "op-w-f2", kind: "window", facade: "front", offsetM: 2.6, sillM: GROUND_SILL, widthM: WINDOW_W, heightM: WINDOW_H },
  { id: "op-w-f3", kind: "window", facade: "front", offsetM: -2.6, sillM: UPPER_SILL, widthM: WINDOW_W, heightM: WINDOW_H },
  { id: "op-w-f4", kind: "window", facade: "front", offsetM: 0, sillM: UPPER_SILL, widthM: WINDOW_W, heightM: WINDOW_H },
  { id: "op-w-f5", kind: "window", facade: "front", offsetM: 2.6, sillM: UPPER_SILL, widthM: WINDOW_W, heightM: WINDOW_H },

  { id: "op-w-b1", kind: "window", facade: "back", offsetM: 0, sillM: GROUND_SILL, widthM: WINDOW_W, heightM: WINDOW_H },
  { id: "op-w-b2", kind: "window", facade: "back", offsetM: 0, sillM: UPPER_SILL, widthM: WINDOW_W, heightM: WINDOW_H },

  { id: "op-w-l1", kind: "window", facade: "left", offsetM: 0, sillM: UPPER_SILL, widthM: WINDOW_W, heightM: WINDOW_H },
  { id: "op-w-r1", kind: "window", facade: "right", offsetM: 0, sillM: UPPER_SILL, widthM: WINDOW_W, heightM: WINDOW_H },
];

function demoHouse(photoCount: number): SceneModel {
  const roof = {
    shape: "gable" as const,
    pitchDeg: 32,
    overhangM: MIN_ROOF_OVERHANG_M,
  };

  const model: SceneModel = {
    id: "house-demo-1",
    name: "Дом на ул. Садовая, 12",
    createdAt: new Date().toISOString(),
    sourcePhotoCount: photoCount,
    dimensions: DIMENSIONS,
    openings: OPENINGS,
    nodes: [
      {
        id: "node-roof",
        label: "Крыша",
        kind: "roof",
        materialId: "roof-metal-tile",
        quantity: roofAreaM2(DIMENSIONS, roof),
        unit: "m2",
        colorHex: "#8A4A32",
        roof,
      },
      {
        id: "node-facade-front",
        label: "Фасад — главный",
        kind: "facade",
        materialId: "facade-plaster",
        quantity: facadeAreaM2(DIMENSIONS, OPENINGS, "front"),
        unit: "m2",
        colorHex: "#EDE6D6",
      },
      {
        id: "node-facade-back",
        label: "Фасад — задний",
        kind: "facade",
        materialId: "facade-plaster",
        quantity: facadeAreaM2(DIMENSIONS, OPENINGS, "back"),
        unit: "m2",
        colorHex: "#EDE6D6",
      },
      {
        id: "node-facade-left",
        label: "Фасад — левый",
        kind: "facade",
        materialId: "facade-plaster",
        quantity: facadeAreaM2(DIMENSIONS, OPENINGS, "left"),
        unit: "m2",
        colorHex: "#EDE6D6",
      },
      {
        id: "node-facade-right",
        label: "Фасад — правый",
        kind: "facade",
        materialId: "facade-plaster",
        quantity: facadeAreaM2(DIMENSIONS, OPENINGS, "right"),
        unit: "m2",
        colorHex: "#EDE6D6",
      },
      {
        id: "node-foundation",
        label: "Фундамент",
        kind: "foundation",
        materialId: "foundation-strip",
        quantity: foundationAreaM2(DIMENSIONS),
        unit: "m2",
        colorHex: "#6B6660",
      },
      {
        id: "node-fence",
        label: "Ограждение участка",
        kind: "fence",
        materialId: "fence-profnastil",
        quantity: fenceLengthM(DIMENSIONS),
        unit: "m",
        colorHex: "#3E2A1F",
      },
      {
        id: "node-windows",
        label: "Окна",
        kind: "window",
        materialId: "window-pvc",
        quantity: OPENINGS.filter((o) => o.kind === "window").length,
        unit: "pcs",
        colorHex: "#F2EFE8",
      },
      {
        id: "node-door",
        label: "Входная дверь",
        kind: "door",
        materialId: "door-steel",
        quantity: OPENINGS.filter((o) => o.kind === "door").length,
        unit: "pcs",
        colorHex: "#2B2B2B",
      },
    ],
  };

  return withRecalculatedQuantities(model);
}

/**
 * Stands in for the Neural4D vendor while its API isn't available yet.
 * Realistic delays and believable Russian sample data so every screen
 * downstream (editor, cart, education, services) is fully testable
 * without a live vendor connection.
 */
export class MockModel3DProvider implements Model3DProvider {
  private currentModel: SceneModel | null = null;

  async generateFromPhotos(photos: File[]): Promise<SceneModel> {
    await delay(2600);
    const model = demoHouse(photos.length || 4);
    this.currentModel = model;
    return model;
  }

  adoptModel(model: SceneModel): void {
    this.currentModel = model;
  }

  async applyMaterial(nodeId: string, materialId: string): Promise<SceneModel> {
    await delay(350);
    if (!this.currentModel) {
      throw new Error("Модель ещё не сгенерирована — сначала загрузите фотографии.");
    }
    const material = materialById(materialId);
    if (!material) {
      throw new Error(`Материал ${materialId} не найден.`);
    }
    this.currentModel = {
      ...this.currentModel,
      nodes: this.currentModel.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, materialId, colorHex: material.colorHex }
          : node,
      ),
    };
    return this.currentModel;
  }

  getBillOfMaterials(model: SceneModel): BomLine[] {
    return model.nodes.map((node) => {
      const material =
        materialById(node.materialId) ?? materialsForKind(node.kind)[0];
      const pricePerUnit = material?.pricePerUnit ?? 0;
      return {
        id: `bom-${node.id}`,
        nodeId: node.id,
        nodeLabel: node.label,
        materialId: node.materialId,
        materialName: material?.name ?? "Материал не выбран",
        quantity: node.quantity,
        unit: node.unit,
        pricePerUnit,
        total: Math.round(pricePerUnit * node.quantity),
      };
    });
  }
}
