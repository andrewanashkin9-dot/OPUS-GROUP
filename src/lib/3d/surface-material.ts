import * as THREE from "three";
import { createSurfaceTexture, tileMetresOf } from "./textures";
import type { TextureId } from "./types";

/**
 * Один материал поверхности — не картинка, а поведение под светом.
 *
 * До этого на каждую поверхность вешалась только карта цвета:
 * `<meshStandardMaterial map={…} roughness={0.85} />`. Рисунок был, но вёл
 * себя как наклейка — кирпич, фальцевая кровля и стекло отражали свет
 * одинаково, и смена материала читалась как смена оттенка. Разницу между
 * материалами делает не цвет, а два других свойства:
 *
 *  - рельеф. Тот же рисунок, поданный как карта неровностей, даёт швам и
 *    рёбрам собственную тень. Кирпич перестаёт быть плоским, у профнастила
 *    появляются рёбра, у фальца — стоячие швы;
 *  - отражение. Металлическая кровля бликует узкой полосой, штукатурка
 *    рассеивает свет во все стороны. Один шершавый параметр на всё делал их
 *    неразличимыми.
 *
 * Карты берутся из одного холста: `clone()` у текстуры разделяет
 * изображение и заводит только новую обёртку. Второй раз рисовать тот же
 * узор незачем.
 */

interface SurfaceLook {
  /** 0 — свет рассеивается полностью, 1 — зеркало. */
  roughness: number;
  metalness: number;
  /** Глубина рельефа в единицах карты неровностей. */
  bump: number;
}

/**
 * Как каждый материал ведёт себя под светом.
 *
 * Числа не выдуманы из головы: металл отражает узко и потому шершавость у
 * него низкая, а металличность высокая; минеральные поверхности —
 * наоборот. Рельеф глубже там, где у настоящего материала крупный шов или
 * ребро (кирпич, профнастил, штакетник), и почти нулевой у гладкого —
 * стекла и панелей.
 */
const LOOK: Record<TextureId, SurfaceLook> = {
  "brick-running": { roughness: 0.94, metalness: 0, bump: 0.055 },
  "brick-clinker": { roughness: 0.86, metalness: 0, bump: 0.05 },
  "brick-aged": { roughness: 0.96, metalness: 0, bump: 0.06 },
  block: { roughness: 0.95, metalness: 0, bump: 0.04 },
  plaster: { roughness: 0.97, metalness: 0, bump: 0.015 },
  planken: { roughness: 0.8, metalness: 0, bump: 0.045 },
  panel: { roughness: 0.62, metalness: 0.15, bump: 0.02 },
  "tile-metal": { roughness: 0.42, metalness: 0.55, bump: 0.05 },
  "tile-shingle": { roughness: 0.9, metalness: 0, bump: 0.04 },
  "tile-wave": { roughness: 0.68, metalness: 0.1, bump: 0.06 },
  seam: { roughness: 0.34, metalness: 0.7, bump: 0.045 },
  profnastil: { roughness: 0.4, metalness: 0.6, bump: 0.07 },
  shtaketnik: { roughness: 0.5, metalness: 0.45, bump: 0.05 },
  forged: { roughness: 0.45, metalness: 0.8, bump: 0.03 },
  concrete: { roughness: 0.93, metalness: 0, bump: 0.03 },
  glass: { roughness: 0.08, metalness: 0.1, bump: 0 },
  "wood-door": { roughness: 0.72, metalness: 0, bump: 0.03 },
  "steel-door": { roughness: 0.45, metalness: 0.6, bump: 0.02 },
};

export interface SurfaceMaterialOptions {
  /**
   * Развёртка, по которой класть карты. 0 — та, что у меша своя; 1 —
   * вторая, которую мы строим сами для чужой геометрии.
   */
  uvChannel?: 0 | 1;
  /**
   * Видна ли поверхность с изнанки.
   *
   * Нужно скату кровли: это открытая плоскость без толщины, и снизу, из-под
   * свеса, на неё смотрят с обратной стороны. Задаётся здесь, а не правкой
   * готового материала — менять то, что вернул хук, правила React запрещают,
   * и справедливо: следующий рендер вернул бы прежнее значение.
   */
  doubleSided?: boolean;
  /**
   * Развёртка размечена в метрах, а не в долях поверхности.
   *
   * Так размечается чужая геометрия: у меша от вендора своя развёртка под
   * его собственную текстуру с фотографии, и наш кирпич по ней лёг бы
   * растянутым как попало. Мы строим вторую развёртку проекцией по осям, и
   * там координата — это метр. Тогда повтор задаётся один раз, размером
   * самого кирпича, и не зависит от того, какую поверхность им кроют.
   */
  metresUv?: boolean;
}

/**
 * Материал поверхности со всеми картами. Вызывающий обязан его освободить —
 * текстуры держат память видеокарты, и сборщик мусора о ней не знает.
 */
export function createSurfaceMaterial(
  textureId: TextureId,
  color: string,
  widthM: number,
  heightM: number,
  options: SurfaceMaterialOptions = {},
): THREE.MeshStandardMaterial {
  const look = LOOK[textureId] ?? { roughness: 0.9, metalness: 0, bump: 0.03 };
  const channel = options.uvChannel ?? 0;

  const map = createSurfaceTexture(textureId, color, widthM, heightM);
  map.channel = channel;
  if (options.metresUv) {
    const tile = tileMetresOf(textureId);
    map.repeat.set(1 / tile, 1 / tile);
  }

  const material = new THREE.MeshStandardMaterial({
    map,
    roughness: look.roughness,
    metalness: look.metalness,
    side: options.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });

  if (look.bump > 0) {
    // Тот же холст, другая роль: рельеф читается из яркости рисунка, а швы
    // на нём и так темнее самого материала.
    // clone() делит изображение, но не настройки — повтор надо перенести,
    // иначе рельеф ляжет в другом масштабе, чем цвет, и разъедется с ним.
    const bumpMap = map.clone();
    bumpMap.channel = channel;
    bumpMap.repeat.copy(map.repeat);
    material.bumpMap = bumpMap;
    material.bumpScale = look.bump;

    // Шов блестит иначе, чем плоскость рядом. Без этого крупная поверхность
    // отражает свет одинаково по всей площади и выглядит напечатанной.
    const roughnessMap = map.clone();
    roughnessMap.channel = channel;
    roughnessMap.repeat.copy(map.repeat);
    material.roughnessMap = roughnessMap;
  }

  if (textureId === "glass") {
    material.envMapIntensity = 1.6;
  }

  return material;
}

/** Освобождает материал вместе со всеми его картами. */
export function disposeSurfaceMaterial(material: THREE.Material | null): void {
  if (!material) return;
  const standard = material as THREE.MeshStandardMaterial;
  standard.map?.dispose();
  standard.bumpMap?.dispose();
  standard.roughnessMap?.dispose();
  material.dispose();
}
