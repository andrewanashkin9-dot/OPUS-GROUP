import { MockModel3DProvider } from "./mock-provider";
import type { Model3DProvider } from "./provider";
import { validateSceneModel } from "./scene-model-schema";
import type { BomLine, HouseConfig, SceneModel } from "./types";

/**
 * Провайдер, работающий через собственный backend.
 *
 * Здесь намеренно нет ни ключей, ни адресов вендоров — этот файл попадает в
 * браузерный бандл, поэтому всё, что он знает, знает и любой посетитель.
 * Единственный адрес, который он вызывает, — наш собственный маршрут.
 *
 * Он также не знает, какой вендор работает: Neural4D или GenAPI. Это
 * сознательно. Выбор вендора определяет, чей счёт оплачивается, и если бы
 * его делал браузер, посетитель мог бы переключить генерацию на другой ваш
 * счёт. Решение принимает сервер по ACTIVE_3D_PROVIDER.
 *
 * Пока ключ активного вендора не задан, маршрут отвечает
 * { configured: false }, и провайдер прозрачно продолжает работу на
 * помеченном образце — пустой .env не ломает ни разработку, ни показ.
 */

/** Наш маршрут, не вендорский. */
const GENERATE_ENDPOINT = "/api/model3d/generate";

export class BackendModel3DProvider implements Model3DProvider {
  /**
   * Не только запасной вариант: смена материала, этажности и расчёт сметы —
   * операции над уже полученной моделью, они не требуют обращения к вендору.
   */
  private readonly local = new MockModel3DProvider();

  async generateFromPhotos(photos: File[]): Promise<SceneModel> {
    const body = new FormData();
    for (const photo of photos) body.append("photos", photo, photo.name);

    let response: Response;
    try {
      response = await fetch(GENERATE_ENDPOINT, { method: "POST", body });
    } catch {
      throw new Error(
        "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.",
      );
    }

    if (!response.ok) {
      throw new Error(
        (await safeMessage(response)) ??
          "Не удалось построить модель. Попробуйте ещё раз.",
      );
    }

    const payload: unknown = await response.json();

    // Ключ ещё не вписан — показываем помеченный образец. Приходит как
    // обычный успешный ответ, поэтому в консоли нет ложной ошибки.
    if (
      payload &&
      typeof payload === "object" &&
      "configured" in payload &&
      (payload as { configured: unknown }).configured === false
    ) {
      return this.local.generateFromPhotos(photos);
    }

    // Проверяем и здесь, а не только на сервере: между ними стоит сеть, и
    // приводить чужой JSON к SceneModel вслепую нельзя.
    const result = validateSceneModel(payload, "photos");
    if (!result.ok) {
      throw new Error(
        "Модель пришла в неожиданном формате. Попробуйте ещё раз или напишите нам.",
      );
    }

    this.local.adoptModel(result.model);
    return result.model;
  }

  adoptModel(model: SceneModel): void {
    this.local.adoptModel(model);
  }

  applyMaterial(nodeId: string, materialId: string): Promise<SceneModel> {
    return this.local.applyMaterial(nodeId, materialId);
  }

  reconfigure(config: HouseConfig): Promise<SceneModel> {
    return this.local.reconfigure(config);
  }

  getBillOfMaterials(model: SceneModel): BomLine[] {
    return this.local.getBillOfMaterials(model);
  }
}

/** Сообщение для пользователя — только то, что сформировал наш маршрут. */
async function safeMessage(response: Response): Promise<string | null> {
  try {
    const data = (await response.json()) as { error?: string };
    return typeof data.error === "string" ? data.error : null;
  } catch {
    return null;
  }
}
