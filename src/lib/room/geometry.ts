import {
  OPENING_LIMITS,
  ROOM_LIMITS,
  type RoomModel,
  type RoomOpening,
  type RoomSurface,
  type SurfaceId,
} from "./types";

/** Точка на плане. X — вправо, Z — на зрителя; Y в плане не участвует. */
export interface PlanPoint {
  x: number;
  z: number;
}

export interface RoomWall {
  id: SurfaceId;
  /** Порядковый номер по обходу, с нуля. */
  index: number;
  label: string;
  /** Левый угол стены, если встать в комнате лицом к ней. */
  start: PlanPoint;
  end: PlanPoint;
  lengthM: number;
  heightM: number;
  /** Единичный вектор вдоль стены, от `start` к `end`. */
  dir: PlanPoint;
  /** Единичная нормаль внутрь комнаты. */
  inward: PlanPoint;
  /** Поворот вокруг Y, при котором плоскость стены смотрит внутрь комнаты. */
  rotationY: number;
}

/** «wall-2» → 2. Возвращает null для пола и потолка. */
export function wallIndex(id: SurfaceId): number | null {
  const found = /^wall-(\d+)$/.exec(id);
  return found ? Number(found[1]) : null;
}

export function isWall(id: SurfaceId): boolean {
  return wallIndex(id) !== null;
}

/**
 * Углы комнаты по обходу.
 *
 * Обход начинается от дальнего левого угла и идёт так же, как человек
 * обходит комнату с рулеткой: вдоль дальней стены вправо, потом по правой на
 * себя, и так по кругу. Из этого порядка бесплатно следует и нумерация стен,
 * и то, какой угол каждой стены считается левым.
 */
export function roomCorners(model: RoomModel): PlanPoint[] {
  const { widthM, lengthM } = model.dimensions;
  const x = widthM / 2;
  const z = lengthM / 2;
  const rect: PlanPoint[] = [
    { x: -x, z: -z },
    { x, z: -z },
    { x, z },
    { x: -x, z },
  ];

  if (model.shape !== "l" || !model.notch) return rect;

  // Вырез срезает один угол прямоугольника, заменяя его тремя точками.
  const { corner, widthM: nw, lengthM: nl } = model.notch;
  const at = { nw: 0, ne: 1, se: 2, sw: 3 }[corner];
  const c = rect[at];
  // Знаки — направления «внутрь комнаты» от этого угла по каждой оси.
  const sx = c.x < 0 ? 1 : -1;
  const sz = c.z < 0 ? 1 : -1;
  // Порядок вставки зависит от того, вдоль какой оси обход входит в угол.
  // Обход идёт NW → NE → SE → SW, значит в ne и sw мы приезжаем по оси X,
  // а в nw и se — по оси Z, и «остановиться, не доезжая» надо по разным осям.
  const alongX = corner === "ne" || corner === "sw";
  const cut: PlanPoint[] = alongX
    ? [
        { x: c.x + sx * nw, z: c.z },
        { x: c.x + sx * nw, z: c.z + sz * nl },
        { x: c.x, z: c.z + sz * nl },
      ]
    : [
        { x: c.x, z: c.z + sz * nl },
        { x: c.x + sx * nw, z: c.z + sz * nl },
        { x: c.x + sx * nw, z: c.z },
      ];

  return [...rect.slice(0, at), ...cut, ...rect.slice(at + 1)];
}

export function roomWalls(model: RoomModel): RoomWall[] {
  const corners = roomCorners(model);
  const { heightM } = model.dimensions;

  return corners.map((start, i) => {
    const end = corners[(i + 1) % corners.length];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthM = Math.hypot(dx, dz);
    const dir = { x: dx / lengthM, z: dz / lengthM };
    // Обход задан так, что площадь по формуле шнурков положительна, а значит
    // левая нормаль к направлению обхода всегда смотрит внутрь комнаты.
    const inward = { x: -dir.z, z: dir.x };
    return {
      id: `wall-${i}` as SurfaceId,
      index: i,
      label: `Стена ${i + 1}`,
      start,
      end,
      lengthM,
      heightM,
      dir,
      inward,
      rotationY: Math.atan2(inward.x, inward.z),
    };
  });
}

export function wallById(model: RoomModel, id: SurfaceId): RoomWall | undefined {
  const index = wallIndex(id);
  if (index === null) return undefined;
  return roomWalls(model)[index];
}

/** Площадь многоугольника плана по формуле шнурков. */
export function floorAreaM2(model: RoomModel): number {
  const corners = roomCorners(model);
  let sum = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) / 2;
}

export function perimeterM(model: RoomModel): number {
  return roomWalls(model).reduce((sum, wall) => sum + wall.lengthM, 0);
}

export function openingsOnWall(model: RoomModel, id: SurfaceId): RoomOpening[] {
  return model.openings.filter((o) => o.wall === id);
}

export function openingAreaM2(opening: RoomOpening): number {
  return opening.widthM * opening.heightM;
}

/**
 * Поверхности комнаты в том порядке, в каком их выбирают: сначала пол,
 * потом стены по обходу, потом потолок.
 */
export function roomSurfaces(model: RoomModel): RoomSurface[] {
  const floor = floorAreaM2(model);
  const walls = roomWalls(model);

  return [
    {
      id: "floor",
      kind: "floor",
      label: "Пол",
      grossM2: floor,
      netM2: floor,
      openingsM2: 0,
      runM: perimeterM(model),
    },
    ...walls.map((wall): RoomSurface => {
      const gross = wall.lengthM * wall.heightM;
      const cut = openingsOnWall(model, wall.id).reduce(
        (sum, o) => sum + openingAreaM2(o),
        0,
      );
      return {
        id: wall.id,
        kind: "wall",
        label: wall.label,
        grossM2: gross,
        // Проём не может съесть стену целиком: валидация это не пропустит,
        // но при восстановлении старого проекта отрицательная площадь была
        // бы куда неприятнее обрезанного нуля.
        netM2: Math.max(0, gross - cut),
        openingsM2: Math.min(gross, cut),
        runM: wall.lengthM,
      };
    }),
    {
      id: "ceiling",
      kind: "ceiling",
      label: "Потолок",
      grossM2: floor,
      netM2: floor,
      openingsM2: 0,
      runM: perimeterM(model),
    },
  ];
}

export function surfaceById(
  model: RoomModel,
  id: SurfaceId,
): RoomSurface | undefined {
  return roomSurfaces(model).find((s) => s.id === id);
}

// ------------------------------------------------------------ проверки

/**
 * Минимальный простенок между проёмом и углом или соседним проёмом.
 *
 * Ноль здесь был бы враньём: дверь, упирающаяся коробкой в угол, не встаёт,
 * а окно вплотную к углу негде опереть.
 */
export const MIN_JAMB_M = 0.1;

/** Ошибки — по-человечески: их читает хозяин квартиры, а не инженер. */
export function validateOpening(
  model: RoomModel,
  opening: RoomOpening,
): string | null {
  const wall = wallById(model, opening.wall);
  if (!wall) return "Эта стена больше не существует — выберите другую.";

  const limits = OPENING_LIMITS[opening.kind];
  const noun = opening.kind === "door" ? "Дверь" : "Окно";

  if (opening.widthM < limits.widthM.min || opening.widthM > limits.widthM.max) {
    return `Ширина: от ${fmt(limits.widthM.min)} до ${fmt(limits.widthM.max)} м.`;
  }
  if (
    opening.heightM < limits.heightM.min ||
    opening.heightM > limits.heightM.max
  ) {
    return `Высота: от ${fmt(limits.heightM.min)} до ${fmt(limits.heightM.max)} м.`;
  }
  if (opening.sillM < 0) return "Низ проёма не может быть ниже пола.";
  if (opening.sillM + opening.heightM > model.dimensions.heightM + 1e-6) {
    return `${noun} не помещается по высоте: до потолка ${fmt(model.dimensions.heightM)} м.`;
  }
  if (opening.offsetM < MIN_JAMB_M) {
    return `Оставьте от угла хотя бы ${fmt(MIN_JAMB_M)} м.`;
  }
  if (opening.offsetM + opening.widthM > wall.lengthM - MIN_JAMB_M + 1e-6) {
    return `${noun} не помещается: длина стены ${fmt(wall.lengthM)} м.`;
  }

  for (const other of openingsOnWall(model, opening.wall)) {
    if (other.id === opening.id) continue;
    const gap =
      Math.max(opening.offsetM, other.offsetM) -
      Math.min(opening.offsetM + opening.widthM, other.offsetM + other.widthM);
    if (gap < MIN_JAMB_M - 1e-6) {
      return "Проёмы накладываются друг на друга.";
    }
  }

  return null;
}

export function validateDimensions(model: RoomModel): string | null {
  const { widthM, lengthM, heightM } = model.dimensions;
  const checks: [number, { min: number; max: number }, string][] = [
    [widthM, ROOM_LIMITS.widthM, "Ширина"],
    [lengthM, ROOM_LIMITS.lengthM, "Длина"],
    [heightM, ROOM_LIMITS.heightM, "Высота"],
  ];
  for (const [value, limit, label] of checks) {
    if (!Number.isFinite(value) || value < limit.min || value > limit.max) {
      return `${label}: от ${fmt(limit.min)} до ${fmt(limit.max)} м.`;
    }
  }

  if (model.shape === "l" && model.notch) {
    const { widthM: nw, lengthM: nl } = model.notch;
    // Вырез, доходящий до противоположной стены, оставляет не комнату,
    // а коридор нулевой ширины.
    if (nw < 0.5 || nl < 0.5) return "Вырез угла: не меньше 0,5 м по каждой стороне.";
    if (nw > widthM - 1) return `Вырез по ширине: не больше ${fmt(widthM - 1)} м.`;
    if (nl > lengthM - 1) return `Вырез по длине: не больше ${fmt(lengthM - 1)} м.`;
  }

  return null;
}

/**
 * Проёмы, которые перестали помещаться после правки размеров комнаты.
 *
 * Уменьшить стену и молча оставить в ней дверь, торчащую за угол, — худший
 * из возможных исходов: смета останется правдоподобной и неверной.
 */
export function strandedOpenings(model: RoomModel): RoomOpening[] {
  return model.openings.filter((o) => validateOpening(model, o) !== null);
}

/**
 * Где поставить новый проём этой ширины, чтобы он никуда не упирался.
 *
 * Сначала пробуется середина стены — туда его и поставил бы человек. Если
 * там уже что-то есть, ищется первый свободный простенок слева направо.
 * null означает, что стена занята: лучше отказать, чем воткнуть окно в дверь.
 */
export function suggestOffsetM(
  model: RoomModel,
  wallId: SurfaceId,
  widthM: number,
): number | null {
  const wall = wallById(model, wallId);
  if (!wall) return null;

  const taken = openingsOnWall(model, wallId)
    .map((o) => [o.offsetM, o.offsetM + o.widthM] as const)
    .sort((a, b) => a[0] - b[0]);

  const fits = (start: number) =>
    start >= MIN_JAMB_M &&
    start + widthM <= wall.lengthM - MIN_JAMB_M + 1e-9 &&
    taken.every(
      ([from, to]) =>
        start + widthM <= from - MIN_JAMB_M + 1e-9 ||
        start >= to + MIN_JAMB_M - 1e-9,
    );

  const centre = (wall.lengthM - widthM) / 2;
  if (fits(centre)) return round(centre);

  let cursor = MIN_JAMB_M;
  for (const [from, to] of taken) {
    if (fits(cursor) && cursor + widthM <= from - MIN_JAMB_M + 1e-9) {
      return round(cursor);
    }
    cursor = Math.max(cursor, to + MIN_JAMB_M);
  }
  return fits(cursor) ? round(cursor) : null;
}

/**
 * Сдвигает проёмы, которые вылезли за укоротившуюся стену, обратно внутрь.
 *
 * Только сдвигает: если проём не помещается по ширине или по высоте, его
 * молча ужимать нельзя — размер двери человек задал сам, и подправленная
 * за его спиной дверь вернётся к нему ошибкой в смете.
 */
export function reflowOpenings(model: RoomModel): RoomOpening[] {
  return model.openings.map((opening) => {
    const wall = wallById(model, opening.wall);
    if (!wall) return opening;
    const max = wall.lengthM - MIN_JAMB_M - opening.widthM;
    if (max < MIN_JAMB_M) return opening;
    const offsetM = Math.min(Math.max(opening.offsetM, MIN_JAMB_M), max);
    return offsetM === opening.offsetM ? opening : { ...opening, offsetM: round(offsetM) };
  });
}

/** «2,7» — запятая, как в любом российском замере. */
function fmt(value: number): string {
  return value.toFixed(value % 1 === 0 ? 0 : 2).replace(/0$/, "").replace(".", ",");
}

/** Сантиметры — предел, до которого имеет смысл округлять замер. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
