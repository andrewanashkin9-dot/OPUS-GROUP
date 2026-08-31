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
 * Сейчас к вендору отсюда не ходят вовсе. Одна генерация стоит 120 баллов,
 * а показывать меш пока негде: покупать картинку, которую никто не увидит,
 * — прямой убыток. Запрос вернётся вместе с показом меша, и в нём будет
 * один вариант на запрос, а не четыре, как вендор делает по умолчанию.
 */

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
