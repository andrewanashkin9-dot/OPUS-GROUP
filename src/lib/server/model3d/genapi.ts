import "server-only";
import type { Model3DVendor, VendorResponse } from "./types";

/**
 * GenAPI — российский агрегатор, за которым стоят Meshy, Tripo3D и Rodin,
 * с оплатой в рублях. Собственный ключ, собственный счёт: он намеренно не
 * делит переменную с Neural4D, иначе компрометация одного ключа заставляла
 * бы отзывать доступ сразу к обоим вендорам.
 *
 * Какую из моделей просить у агрегатора, задаёт GENAPI_MODEL.
 *
 * Контракт агрегатора не подтверждён — проверить его из песочницы нельзя,
 * сеть наружу закрыта. Поэтому адрес, путь и имя модели вынесены в
 * окружение, а разбор ответа идёт через одну функцию ниже: если реальный
 *формат отличается, правка нужна ровно в ней.
 */
export class GenApiModel3DProvider implements Model3DVendor {
  readonly id = "genapi" as const;
  readonly label = "GenAPI";

  private get apiKey(): string {
    return process.env.GENAPI_KEY?.trim() ?? "";
  }

  private get apiUrl(): string {
    return process.env.GENAPI_URL?.trim() || "https://api.gen-api.ru/api/v1";
  }

  /** Meshy по умолчанию: из трёх он лучше держит геометрию зданий. */
  private get model(): string {
    return process.env.GENAPI_MODEL?.trim() || "meshy";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async requestReconstruction(
    photos: File[],
    signal: AbortSignal,
  ): Promise<VendorResponse> {
    const body = new FormData();
    for (const photo of photos) body.append("images", photo, photo.name);
    // Агрегатору нужно сказать, какой из движков запускать.
    body.append("model", this.model);

    const response = await fetch(`${this.apiUrl}/networks/${this.model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body,
      signal,
    });

    if (!response.ok) {
      return { ok: false, status: response.status, kind: "http" };
    }
    try {
      return { ok: true, payload: await response.json() };
    } catch {
      return { ok: false, status: response.status, kind: "not_json" };
    }
  }
}
