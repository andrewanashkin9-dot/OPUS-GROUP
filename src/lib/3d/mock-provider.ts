import { materialById, materialsForKind } from "./materials";
import type { Model3DProvider } from "./provider";
import type { BomLine, SceneModel } from "./types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function demoHouse(photoCount: number): SceneModel {
  return {
    id: "house-demo-1",
    name: "Дом на ул. Садовая, 12",
    createdAt: new Date().toISOString(),
    sourcePhotoCount: photoCount,
    dimensions: { widthM: 9.5, depthM: 8.2, heightM: 6.4 },
    nodes: [
      {
        id: "node-roof",
        label: "Крыша",
        kind: "roof",
        materialId: "roof-metal-tile-terracotta",
        quantity: 96,
        unit: "m2",
        colorHex: "#8A4A32",
        roof: { shape: "gable", pitchDeg: 30 },
      },
      {
        id: "node-facade-front",
        label: "Фасад — главный",
        kind: "facade",
        materialId: "facade-plaster-warm-white",
        quantity: 62,
        unit: "m2",
        colorHex: "#EDE6D6",
      },
      {
        id: "node-facade-back",
        label: "Фасад — задний",
        kind: "facade",
        materialId: "facade-plaster-warm-white",
        quantity: 58,
        unit: "m2",
        colorHex: "#EDE6D6",
      },
      {
        id: "node-facade-left",
        label: "Фасад — левый",
        kind: "facade",
        materialId: "facade-plaster-warm-white",
        quantity: 44,
        unit: "m2",
        colorHex: "#EDE6D6",
      },
      {
        id: "node-facade-right",
        label: "Фасад — правый",
        kind: "facade",
        materialId: "facade-plaster-warm-white",
        quantity: 44,
        unit: "m2",
        colorHex: "#EDE6D6",
      },
      {
        id: "node-foundation",
        label: "Фундамент",
        kind: "foundation",
        materialId: "foundation-strip",
        quantity: 78,
        unit: "m2",
        colorHex: "#6B6660",
      },
      {
        id: "node-fence",
        label: "Ограждение участка",
        kind: "fence",
        materialId: "fence-profnastil-brown",
        quantity: 46,
        unit: "m",
        colorHex: "#3E2A1F",
      },
      {
        id: "node-windows",
        label: "Окна",
        kind: "window",
        materialId: "window-pvc-white",
        quantity: 9,
        unit: "pcs",
        colorHex: "#F2EFE8",
      },
    ],
  };
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
