import { BackendModel3DProvider } from "./backend-provider";
import type { Model3DProvider } from "./provider";

let provider: Model3DProvider | null = null;

/**
 * Единственная точка выбора провайдера на клиенте.
 *
 * Клиент всегда ходит в наш backend и не выбирает вендора: какой из них
 * работает — Neural4D или GenAPI — решает ACTIVE_3D_PROVIDER на сервере.
 * Поэтому здесь нет ни публичной переменной, ни флага, по которому можно
 * было бы догадаться о состоянии ключей.
 */
export function getModel3DProvider(): Model3DProvider {
  if (!provider) {
    provider = new BackendModel3DProvider();
  }
  return provider;
}

export type { Model3DProvider } from "./provider";
export * from "./types";
export { MATERIALS, materialsForKind, materialById } from "./materials";
export { EDUCATION_CARDS, educationCardForKind } from "./education";
