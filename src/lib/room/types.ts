/**
 * Комната: параметрическая модель интерьера.
 *
 * Это сознательно НЕ то же самое, что src/lib/3d — там дом восстанавливается
 * по фотографиям генеративной моделью и приходит безразмерной сеткой, которую
 * потом приходится масштабировать. Комнату так строить нельзя: человек её уже
 * обмерил рулеткой, и любая догадка сервиса о размерах будет хуже его замера.
 * Поэтому здесь нет провайдера и нет генерации — вся геометрия выводится из
 * введённых метров.
 */

/** Прямоугольник — база; Г-образная комната добавляет вырез угла. */
export type RoomShape = "rect" | "l";

/** Что это за поверхность с точки зрения отделки. */
export type SurfaceKind = "floor" | "ceiling" | "wall";

/**
 * Идентификатор поверхности. Стены нумеруются по обходу комнаты, начиная от
 * дальнего левого угла плана, — тем же порядком, каким её обходят с рулеткой.
 */
export type SurfaceId = "floor" | "ceiling" | `wall-${number}`;

export type OpeningKind = "door" | "window";

/** Проём в стене. Все размеры — в метрах, по проёму в чистоте. */
export interface RoomOpening {
  id: string;
  kind: OpeningKind;
  /** Стена, в которой он прорезан. */
  wall: SurfaceId;
  /**
   * Отступ левого края проёма от левого угла стены, если встать в комнате
   * лицом к этой стене. Единственная точка отсчёта, которую можно повторить
   * рулеткой, не рисуя план.
   */
  offsetM: number;
  widthM: number;
  heightM: number;
  /** Высота низа проёма над чистым полом. У двери — 0. */
  sillM: number;
}

export interface RoomDimensions {
  /** Ширина комнаты по плану, слева направо. */
  widthM: number;
  /** Глубина комнаты по плану, от дальней стены к ближней. */
  lengthM: number;
  /** Высота от чистого пола до потолка. */
  heightM: number;
}

/**
 * Вырез угла у Г-образной комнаты. Отсчитывается от угла плана, названного
 * в `corner`, и не может съесть комнату целиком.
 */
export interface RoomNotch {
  corner: "nw" | "ne" | "se" | "sw";
  /** Сторона выреза по ширине комнаты. */
  widthM: number;
  /** Сторона выреза по глубине комнаты. */
  lengthM: number;
}

export interface RoomModel {
  id: string;
  name: string;
  createdAt: string;
  shape: RoomShape;
  dimensions: RoomDimensions;
  /** Есть только у Г-образной комнаты. */
  notch?: RoomNotch;
  openings: RoomOpening[];
  /** Выбранный материал для каждой поверхности, по id товара. */
  finishes: Partial<Record<SurfaceId, string>>;
  /** Запас на подрезку и брак, в процентах, на весь проект. */
  wastePct: number;
}

/** Комната по умолчанию: типовая жилая, 14,7 м². */
export const DEFAULT_ROOM_DIMENSIONS: RoomDimensions = {
  widthM: 4.2,
  lengthM: 3.5,
  heightM: 2.7,
};

export const DEFAULT_WASTE_PCT = 10;

/** Границы ввода. Ниже — уже не комната, выше — уже не жильё. */
export const ROOM_LIMITS = {
  widthM: { min: 1.5, max: 20 },
  lengthM: { min: 1.5, max: 20 },
  heightM: { min: 2, max: 6 },
  wastePct: { min: 0, max: 30 },
} as const;

export const DEFAULT_DOOR = { widthM: 0.9, heightM: 2.1, sillM: 0 };
export const DEFAULT_WINDOW = { widthM: 1.4, heightM: 1.5, sillM: 0.85 };

export const OPENING_LIMITS = {
  door: { widthM: { min: 0.6, max: 2.4 }, heightM: { min: 1.8, max: 3 } },
  window: { widthM: { min: 0.4, max: 4 }, heightM: { min: 0.4, max: 3 } },
} as const;

/** Одна поверхность комнаты, готовая к отделке и к подсчёту. */
export interface RoomSurface {
  id: SurfaceId;
  kind: SurfaceKind;
  label: string;
  /** Площадь брутто, без вычета проёмов. */
  grossM2: number;
  /** Площадь под отделку: брутто минус проёмы. */
  netM2: number;
  /** Сколько отняли проёмы. 0 у пола и потолка. */
  openingsM2: number;
  /** Длина стены по плану; у пола и потолка — периметр. */
  runM: number;
}
