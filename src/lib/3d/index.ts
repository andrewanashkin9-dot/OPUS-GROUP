import { Neural4DModel3DProvider } from "./neural4d-provider";
import type { Model3DProvider } from "./provider";

let provider: Model3DProvider | null = null;

/**
 * Единственная точка выбора провайдера.
 *
 * Приложение всегда работает через Neural4DModel3DProvider, который ходит в
 * наш собственный backend-маршрут. Пока ключ не вписан, маршрут отвечает
 * "not_configured", и провайдер сам продолжает на демо-модели — поэтому здесь
 * нет ни флага окружения, ни публичной переменной, по которой можно было бы
 * догадаться о состоянии ключа.
 */
export function getModel3DProvider(): Model3DProvider {
  if (!provider) {
    provider = new Neural4DModel3DProvider();
  }
  return provider;
}

export type { Model3DProvider } from "./provider";
export * from "./types";
export { MATERIALS, materialsForKind, materialById } from "./materials";
export { EDUCATION_CARDS, educationCardForKind } from "./education";
