import { buildOpenings, wallHeightM } from "./layout";
import { materialById, materialsForKind } from "./materials";
import {
  facadeAreaM2,
  fenceLengthM,
  foundationAreaM2,
  roofAreaM2,
  withRecalculatedQuantities,
} from "./metrics";
import type { Model3DProvider } from "./provider";
import { styleDef } from "./styles";
import type {
  BomLine,
  HouseConfig,
  NodeKind,
  Opening,
  SceneModel,
  SceneNode,
} from "./types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const FOOTPRINT = { widthM: 9.5, depthM: 8.2 };

const DEFAULT_CONFIG: HouseConfig = { floors: 2, style: "european" };

interface NodeSeed {
  id: string;
  label: string;
  kind: NodeKind;
  unit: SceneNode["unit"];
}

const NODE_SEEDS: NodeSeed[] = [
  { id: "node-roof", label: "Крыша", kind: "roof", unit: "m2" },
  { id: "node-facade-front", label: "Фасад — главный", kind: "facade", unit: "m2" },
  { id: "node-facade-back", label: "Фасад — задний", kind: "facade", unit: "m2" },
  { id: "node-facade-left", label: "Фасад — левый", kind: "facade", unit: "m2" },
  { id: "node-facade-right", label: "Фасад — правый", kind: "facade", unit: "m2" },
  { id: "node-foundation", label: "Фундамент", kind: "foundation", unit: "m2" },
  { id: "node-fence", label: "Ограждение участка", kind: "fence", unit: "m" },
  { id: "node-windows", label: "Окна", kind: "window", unit: "pcs" },
  { id: "node-door", label: "Входная дверь", kind: "door", unit: "pcs" },
];

const FACADE_OF: Record<string, "front" | "back" | "left" | "right"> = {
  "node-facade-front": "front",
  "node-facade-back": "back",
  "node-facade-left": "left",
  "node-facade-right": "right",
};

/**
 * Builds the house for a given storey count and style. `carryOver` keeps the
 * user's own material picks across a change of floors — only a change of
 * style is allowed to reset them, since choosing a style *is* choosing its
 * materials.
 */
function buildHouse(
  config: HouseConfig,
  photoCount: number,
  carryOver?: Map<string, string>,
): SceneModel {
  const style = styleDef(config.style);
  const dimensions = {
    ...FOOTPRINT,
    heightM: wallHeightM(config.floors),
  };
  const openings = buildOpenings(FOOTPRINT, config);

  const nodes: SceneNode[] = NODE_SEEDS.map((seed) => {
    const accent = style.accents?.[seed.id];
    const materialId =
      carryOver?.get(seed.id) ??
      accent?.materialId ??
      style.materials[seed.kind] ??
      materialsForKind(seed.kind)[0]?.id ??
      "";
    const material = materialById(materialId);
    return {
      id: seed.id,
      label: seed.label,
      kind: seed.kind,
      materialId,
      unit: seed.unit,
      quantity: quantityFor(seed, dimensions, openings, config),
      colorHex:
        accent?.colorHex ??
        style.colors[seed.kind] ??
        material?.colorHex ??
        "#EDE6D6",
      roof:
        seed.kind === "roof"
          ? {
              shape: style.roof.shape,
              pitchDeg: style.roof.pitchDeg,
              overhangM: style.roof.overhangM,
            }
          : undefined,
    };
  });

  return withRecalculatedQuantities({
    id: "house-demo-1",
    name: "Дом на ул. Садовая, 12",
    createdAt: new Date().toISOString(),
    sourcePhotoCount: photoCount,
    dimensions,
    floors: config.floors,
    style: config.style,
    nodes,
    openings,
  });
}

function quantityFor(
  seed: NodeSeed,
  dimensions: { widthM: number; depthM: number; heightM: number },
  openings: Opening[],
  config: HouseConfig,
): number {
  const style = styleDef(config.style);
  switch (seed.kind) {
    case "roof":
      return roofAreaM2(dimensions, {
        shape: style.roof.shape,
        pitchDeg: style.roof.pitchDeg,
        overhangM: style.roof.overhangM,
      });
    case "facade":
      return facadeAreaM2(dimensions, openings, FACADE_OF[seed.id] ?? "front");
    case "foundation":
      return foundationAreaM2(dimensions);
    case "fence":
      return fenceLengthM(dimensions);
    case "window":
      return openings.filter((o) => o.kind === "window").length;
    case "door":
      return openings.filter((o) => o.kind === "door").length;
  }
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
    const model = buildHouse(DEFAULT_CONFIG, photos.length || 4);
    this.currentModel = model;
    return model;
  }

  adoptModel(model: SceneModel): void {
    this.currentModel = model;
  }

  /**
   * Storey count and style change the building itself, so the model is rebuilt
   * rather than patched. A real vendor would re-request a model for the new
   * parameters; here it is regenerated locally at the same cost.
   */
  async reconfigure(config: HouseConfig): Promise<SceneModel> {
    await delay(450);
    const previous = this.currentModel;
    const styleChanged = previous?.style !== config.style;
    // Keep the user's material choices when only the storey count moves.
    const carryOver =
      previous && !styleChanged
        ? new Map(previous.nodes.map((n) => [n.id, n.materialId]))
        : undefined;

    const model = buildHouse(
      config,
      previous?.sourcePhotoCount ?? 4,
      carryOver,
    );
    this.currentModel = model;
    return model;
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
