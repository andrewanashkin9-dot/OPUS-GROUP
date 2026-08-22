import { MockModel3DProvider } from "./mock-provider";
import type { Model3DProvider } from "./provider";
import type { BomLine, HouseConfig, SceneModel } from "./types";

/**
 * Провайдер, работающий через собственный backend.
 *
 * Здесь намеренно нет ни ключа, ни адреса Neural4D — этот файл попадает в
 * браузерный бандл, поэтому всё, что он знает, знает и любой посетитель.
 * Единственный адрес, который он вызывает, — наш собственный маршрут; ключ
 * добавляется на сервере.
 *
 * Пока ключ не задан, маршрут отвечает 503 с reason "not_configured", и
 * провайдер прозрачно продолжает работу на mock. Поэтому пустой .env не
 * ломает ни разработку, ни демонстрацию: приложение ведёт себя ровно так же,
 * как сейчас, а с появлением ключа само начинает ходить к вендору.
 */

/** Наш маршрут, не вендорский. */
const GENERATE_ENDPOINT = "/api/neural4d/generate";

export class Neural4DModel3DProvider implements Model3DProvider {
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

    const payload = (await response.json()) as
      | SceneModel
      | { configured: false; reason: string };

    // Ключ ещё не вписан — работаем на демо-модели. Приходит как обычный
    // успешный ответ, поэтому в консоли нет ложной ошибки.
    if ("configured" in payload && payload.configured === false) {
      return this.local.generateFromPhotos(photos);
    }

    const model = payload as SceneModel;
    this.local.adoptModel(model);
    return model;
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
