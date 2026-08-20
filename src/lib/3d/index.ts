import { MockModel3DProvider } from "./mock-provider";
import type { Model3DProvider } from "./provider";

let provider: Model3DProvider | null = null;

/**
 * Single factory seam for the vendor swap: once Neural4D's API is live,
 * add a `Neural4DModel3DProvider` next to the mock and return it here
 * (e.g. behind an env flag). No other file needs to change.
 */
export function getModel3DProvider(): Model3DProvider {
  if (!provider) {
    provider = new MockModel3DProvider();
  }
  return provider;
}

export type { Model3DProvider } from "./provider";
export * from "./types";
export { MATERIALS, materialsForKind, materialById } from "./materials";
export { EDUCATION_CARDS, educationCardForKind } from "./education";
