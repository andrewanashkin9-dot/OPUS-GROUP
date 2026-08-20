import type { BomLine, SceneModel } from "./types";

/**
 * The one seam between the app and the 3D vendor. Neural4D's API isn't
 * available yet, so every screen is built against this interface and the
 * mock implementation in mock-provider.ts. Swapping in the real vendor
 * later means writing one new class here and changing the factory in
 * index.ts — nothing else in the app touches the vendor directly.
 *
 * Vendor requests must never originate from the browser (the API key
 * stays server-side); a real implementation proxies through a backend
 * route instead of calling Neural4D directly from this class.
 */
export interface Model3DProvider {
  generateFromPhotos(photos: File[]): Promise<SceneModel>;
  applyMaterial(nodeId: string, materialId: string): Promise<SceneModel>;
  getBillOfMaterials(model: SceneModel): BomLine[];

  /**
   * Re-seed the provider with a model the app restored from storage after a
   * page reload, so editing can continue without regenerating from photos.
   * Optional: a provider that keeps no per-session state can omit it.
   */
  adoptModel?(model: SceneModel): void;
}
