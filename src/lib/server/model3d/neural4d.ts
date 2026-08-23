import "server-only";
import type { Model3DVendor, VendorResponse } from "./types";

/**
 * Neural4D. Ключ читается только здесь и никогда не логируется.
 *
 * Точные детали контракта (путь, формат тела) не подтверждены — проверить их
 * из песочницы нельзя. Поэтому они вынесены в переменные окружения: если
 * реальный API отличается, правка делается в .env, а не в коде.
 */
export class Neural4DModel3DProvider implements Model3DVendor {
  readonly id = "neural4d" as const;
  readonly label = "Neural4D";

  private get apiKey(): string {
    return process.env.NEURAL4D_API_KEY?.trim() ?? "";
  }

  private get apiUrl(): string {
    return process.env.NEURAL4D_API_URL?.trim() || "https://api.neural4d.com/v1";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async requestReconstruction(
    photos: File[],
    signal: AbortSignal,
  ): Promise<VendorResponse> {
    const body = new FormData();
    for (const photo of photos) body.append("photos", photo, photo.name);

    const response = await fetch(`${this.apiUrl}/reconstruct`, {
      method: "POST",
      // Единственное место, где ключ прикладывается к запросу.
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
