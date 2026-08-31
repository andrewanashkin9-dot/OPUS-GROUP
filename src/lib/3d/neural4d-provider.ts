import { MockModel3DProvider, buildHouse } from "./mock-provider";
import type { Model3DProvider } from "./provider";
import type { BomLine, HouseConfig, SceneModel } from "./types";
import { DEFAULT_FOOTPRINT } from "./types";

/**
 * Провайдер, работающий через собственный backend.
 *
 * Здесь намеренно нет ни ключа, ни адреса Neural4D — этот файл попадает в
 * браузерный бандл, поэтому всё, что он знает, знает и любой посетитель.
 * Единственный адрес, который он вызывает, — наш собственный маршрут; ключ
 * добавляется на сервере.
 *
 * Разделение обязанностей, к которому пришли после трассировки вендора:
 *
 *   размеры  — от человека. Neural4D их не измеряет: он генеративный, из
 *              одной фотографии рисует правдоподобный дом, а не обмеряет
 *              настоящий. Метров, этажей и площадей в его ответе нет вовсе,
 *              и смету из него собрать нельзя;
 *   внешний вид — от Neural4D. Меш приходит асинхронно: сначала задание,
 *              потом опрос готовности. Он ни на одну цифру в смете не
 *              влияет, поэтому редактор не ждёт его и работает сразу.
 *
 * Отсюда главное свойство: генерация модели больше не может «не работать».
 * Дом строится по габаритам мгновенно и локально, а всё, что происходит у
 * вендора, — необязательное улучшение картинки.
 *
 * Генерация не запускается сама. Одна стоит 120 баллов, поэтому её
 * начинает человек кнопкой, а не факт загрузки фотографий: иначе каждая
 * проверка интерфейса покупала бы модель.
 */

/** Наш маршрут постановки задания, не вендорский. */
const GENERATE_ENDPOINT = "/api/neural4d/generate";
/** Наш маршрут опроса готовности. */
const MODEL_ENDPOINT = "/api/neural4d/model";

export type VendorMeshStatus =
  | "idle"
  | "queued"
  | "ready"
  | "out_of_points"
  | "unavailable"
  | "not_configured";

export interface VendorMesh {
  status: VendorMeshStatus;
  /** Номер задания, по которому спрашивают готовность. */
  uuid?: string;
  /** Адрес меша — всегда наш собственный, не вендорский. */
  url?: string;
  message?: string;
}

/**
 * Ставит задание на внешний вид дома.
 *
 * Ошибки не бросаются: смета не зависит от меша ни одной цифрой, и отказ
 * вендора не должен выглядеть как поломка проекта.
 */
export async function startVendorMesh(photos: File[]): Promise<VendorMesh> {
  const body = new FormData();
  for (const photo of photos) body.append("photos", photo, photo.name);

  let response: Response;
  try {
    response = await fetch(GENERATE_ENDPOINT, { method: "POST", body });
  } catch {
    return { status: "unavailable" };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: "unavailable" };
  }

  const data = (payload ?? {}) as {
    uuid?: unknown;
    error?: unknown;
    configured?: unknown;
    reason?: unknown;
  };

  if (data.configured === false) return { status: "not_configured" };
  if (response.ok && typeof data.uuid === "string") {
    return { status: "queued", uuid: data.uuid };
  }

  const message = typeof data.error === "string" ? data.error : undefined;
  return {
    status: data.reason === "out_of_points" ? "out_of_points" : "unavailable",
    message,
  };
}

/** Спрашивает, готова ли модель. Баллов не тратит. */
export async function pollVendorMesh(uuid: string): Promise<VendorMesh> {
  try {
    const response = await fetch(`${MODEL_ENDPOINT}?uuid=${encodeURIComponent(uuid)}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as {
      status?: string;
      url?: string;
      message?: string;
    };
    if (data.status === "ready" && data.url) {
      return { status: "ready", uuid, url: data.url };
    }
    if (data.status === "pending") return { status: "queued", uuid };
    return { status: "unavailable", uuid, message: data.message };
  } catch {
    return { status: "queued", uuid };
  }
}

export class Neural4DModel3DProvider implements Model3DProvider {
  /**
   * Не только запасной вариант: смена материала, этажности, габаритов и
   * расчёт сметы — операции над уже полученной моделью, они не требуют
   * обращения к вендору.
   */
  private readonly local = new MockModel3DProvider();

  async generateFromPhotos(photos: File[]): Promise<SceneModel> {
    // Дом собирается первым и без сети. Раньше здесь ждали ответа вендора, и
    // любой его отказ — неверный адрес, пустой баланс — оставлял человека с
    // пустым экраном и надписью «не удалось построить модель».
    const config: HouseConfig = {
      floors: 2,
      style: "european",
      footprint: DEFAULT_FOOTPRINT,
    };
    const model = buildHouse(config, photos.length, undefined, "photos");
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
