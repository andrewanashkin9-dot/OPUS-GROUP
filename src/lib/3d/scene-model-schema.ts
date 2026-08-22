import { FLOOR_HEIGHT_M } from "./types";
import type { FloorCount, Opening, SceneModel, SceneNode } from "./types";

/**
 * Проверка модели, пришедшей извне.
 *
 * Ответ вендора нельзя просто привести к SceneModel: если формат разойдётся
 * хоть в одном поле, приложение не упадёт сразу, а посчитает смету по мусору —
 * NaN в ценах, пустые узлы, дом без стен. Такую ошибку замечают уже после
 * того, как человек отправил заявку бригаде.
 *
 * Поэтому всё, что приходит снаружи, проходит здесь и либо становится
 * настоящей SceneModel, либо отклоняется с указанием конкретного поля.
 */

export type ValidationResult =
  | { ok: true; model: SceneModel }
  | { ok: false; problems: string[] };

const NODE_KINDS = ["roof", "facade", "fence", "foundation", "window", "door"];
const UNITS = ["m2", "m", "pcs"];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function finitePositive(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function checkNode(node: unknown, i: number, problems: string[]) {
  const at = `nodes[${i}]`;
  if (!isObject(node)) {
    problems.push(`${at}: ожидался объект`);
    return;
  }
  if (typeof node.id !== "string" || !node.id) problems.push(`${at}.id: пусто`);
  if (typeof node.label !== "string") problems.push(`${at}.label: не строка`);
  if (typeof node.kind !== "string" || !NODE_KINDS.includes(node.kind)) {
    problems.push(`${at}.kind: ожидалось одно из ${NODE_KINDS.join("|")}`);
  }
  if (typeof node.materialId !== "string") problems.push(`${at}.materialId: не строка`);
  // Количество — основа сметы. Ноль допустим, отрицательное и NaN нет.
  if (typeof node.quantity !== "number" || !Number.isFinite(node.quantity) || node.quantity < 0) {
    problems.push(`${at}.quantity: ожидалось конечное число ≥ 0`);
  }
  if (typeof node.unit !== "string" || !UNITS.includes(node.unit)) {
    problems.push(`${at}.unit: ожидалось одно из ${UNITS.join("|")}`);
  }
  if (typeof node.colorHex !== "string" || !/^#[0-9a-f]{6}$/i.test(node.colorHex)) {
    problems.push(`${at}.colorHex: ожидался #rrggbb`);
  }
}

function checkOpening(op: unknown, i: number, problems: string[]) {
  const at = `openings[${i}]`;
  if (!isObject(op)) {
    problems.push(`${at}: ожидался объект`);
    return;
  }
  if (op.kind !== "window" && op.kind !== "door") {
    problems.push(`${at}.kind: ожидалось window|door`);
  }
  if (!["front", "back", "left", "right"].includes(String(op.facade))) {
    problems.push(`${at}.facade: ожидалось front|back|left|right`);
  }
  for (const f of ["offsetM", "sillM"]) {
    if (typeof op[f] !== "number" || !Number.isFinite(op[f])) {
      problems.push(`${at}.${f}: ожидалось конечное число`);
    }
  }
  for (const f of ["widthM", "heightM"]) {
    if (!finitePositive(op[f])) problems.push(`${at}.${f}: ожидалось число > 0`);
  }
}

/**
 * Проверяет произвольные данные и возвращает SceneModel либо список проблем.
 * `source` проставляется вызывающей стороной — вендор не может объявить свою
 * модель демонстрационной, и наоборот.
 */
export function validateSceneModel(
  input: unknown,
  source: SceneModel["source"],
): ValidationResult {
  const problems: string[] = [];

  if (!isObject(input)) {
    return { ok: false, problems: ["ответ не является объектом"] };
  }

  if (typeof input.id !== "string" || !input.id) problems.push("id: пусто");
  if (typeof input.name !== "string" || !input.name) problems.push("name: пусто");

  const dims = input.dimensions;
  if (!isObject(dims)) {
    problems.push("dimensions: отсутствует");
  } else {
    for (const f of ["widthM", "depthM", "heightM"]) {
      if (!finitePositive(dims[f])) problems.push(`dimensions.${f}: ожидалось число > 0`);
    }
  }

  if (input.floors !== 1 && input.floors !== 2 && input.floors !== 3) {
    problems.push("floors: ожидалось 1, 2 или 3");
  }

  if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
    problems.push("nodes: ожидался непустой массив");
  } else {
    input.nodes.forEach((n, i) => checkNode(n, i, problems));
  }

  if (!Array.isArray(input.openings)) {
    problems.push("openings: ожидался массив");
  } else {
    input.openings.forEach((o, i) => checkOpening(o, i, problems));
  }

  if (problems.length > 0) return { ok: false, problems };

  const dimensions = dims as Record<string, number>;
  const floors = input.floors as FloorCount;

  // Высота стен всегда кратна этажу. Если вендор прислал другое, доверяем
  // этажности: по ней считаются ряды окон и площадь фасада, и рассогласование
  // здесь развалило бы и геометрию, и смету.
  const heightM = floors * FLOOR_HEIGHT_M;

  return {
    ok: true,
    model: {
      id: String(input.id),
      name: String(input.name),
      createdAt:
        typeof input.createdAt === "string" ? input.createdAt : new Date().toISOString(),
      source,
      sourcePhotoCount:
        typeof input.sourcePhotoCount === "number" ? input.sourcePhotoCount : 0,
      dimensions: {
        widthM: dimensions.widthM,
        depthM: dimensions.depthM,
        heightM,
      },
      floors,
      style:
        typeof input.style === "string" &&
        ["barnhouse", "european", "scandi", "hightech", "classic"].includes(input.style)
          ? (input.style as SceneModel["style"])
          : "european",
      nodes: input.nodes as SceneNode[],
      openings: input.openings as Opening[],
    },
  };
}
