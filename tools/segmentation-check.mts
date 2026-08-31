/**
 * Проверка разбора меша на части дома.
 *
 *     npx tsx tools/segmentation-check.mts
 *
 * Зачем отдельная проверка. Разбор нельзя оценить на глаз: «крыша выглядит
 * крышей» ничего не говорит о том, не попал ли в неё козырёк, который под
 * тем же углом. Нужен дом, про каждый треугольник которого заранее известно,
 * чем он должен оказаться.
 *
 * Дом здесь собирается похожим на то, что отдаёт генеративный сервис, а не
 * на аккуратную модель из редактора:
 *
 *  - всё слито в один меш без имён, материалов и групп — сплошная лента
 *    треугольников, ровно как приходит от вендора;
 *  - каждая грань разбита на сетку, а не на два треугольника: у
 *    сгенерированной модели плотная триангуляция;
 *  - вершины смещены случайным шумом, поэтому плоскостей в математическом
 *    смысле нет, а нормали соседних треугольников слегка расходятся.
 *
 * Ловушка, ради которой всё затевалось, — козырёк над входом: он лежит под
 * тем же углом, что и скат, и разбор по одному углу отнёс бы его к кровле.
 */

import * as THREE from "three";
import {
  MESH_PARTS,
  segmentHouse,
  type MeshPart,
} from "../src/lib/3d/mesh-segmentation.js";

const WIDTH = 10;
const DEPTH = 8;
const WALL_H = 6;
const RIDGE = 3;

/** Повторяемый шум: проверка не должна проходить через раз. */
let seed = 20260831;
function random(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}

interface Part {
  label: string;
  expect: MeshPart;
  quads: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][];
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const hw = WIDTH / 2;
const hd = DEPTH / 2;

const parts: Part[] = [
  {
    label: "стены",
    expect: "wall",
    quads: [
      [v(-hw, 0, hd), v(hw, 0, hd), v(hw, WALL_H, hd), v(-hw, WALL_H, hd)],
      [v(hw, 0, -hd), v(-hw, 0, -hd), v(-hw, WALL_H, -hd), v(hw, WALL_H, -hd)],
      [v(hw, 0, hd), v(hw, 0, -hd), v(hw, WALL_H, -hd), v(hw, WALL_H, hd)],
      [v(-hw, 0, -hd), v(-hw, 0, hd), v(-hw, WALL_H, hd), v(-hw, WALL_H, -hd)],
    ],
  },
  {
    label: "скаты кровли",
    expect: "roof",
    quads: [
      // Двускатная: конёк вдоль ширины, свес за стену.
      [
        v(-hw - 0.6, WALL_H, hd + 0.6),
        v(hw + 0.6, WALL_H, hd + 0.6),
        v(hw + 0.6, WALL_H + RIDGE, 0),
        v(-hw - 0.6, WALL_H + RIDGE, 0),
      ],
      [
        v(hw + 0.6, WALL_H, -hd - 0.6),
        v(-hw - 0.6, WALL_H, -hd - 0.6),
        v(-hw - 0.6, WALL_H + RIDGE, 0),
        v(hw + 0.6, WALL_H + RIDGE, 0),
      ],
    ],
  },
  {
    label: "козырёк над входом",
    // Тот же угол, что у ската, но вчетверо меньше по стороне — это и есть
    // случай, ради которого одного угла недостаточно.
    expect: "minor",
    quads: [
      [
        v(-1.2, 2.6, hd + 1.4),
        v(1.2, 2.6, hd + 1.4),
        v(1.2, 3.4, hd),
        v(-1.2, 3.4, hd),
      ],
    ],
  },
  {
    label: "дымовая труба",
    expect: "minor",
    quads: boxSides(v(2.2, WALL_H + 1.2, -1.0), 0.7, 2.4, 0.7),
  },
  {
    label: "карниз под свесом",
    expect: "minor",
    quads: [
      [
        v(-hw - 0.6, WALL_H - 0.25, hd + 0.6),
        v(hw + 0.6, WALL_H - 0.25, hd + 0.6),
        v(hw + 0.6, WALL_H, hd + 0.6),
        v(-hw - 0.6, WALL_H, hd + 0.6),
      ],
    ],
  },
];

/** Четыре боковые грани параллелепипеда — труба без крышки и дна. */
function boxSides(
  center: THREE.Vector3,
  w: number,
  h: number,
  d: number,
): [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][] {
  const x = w / 2;
  const z = d / 2;
  const y0 = center.y - h / 2;
  const y1 = center.y + h / 2;
  const c = center;
  return [
    [v(c.x - x, y0, c.z + z), v(c.x + x, y0, c.z + z), v(c.x + x, y1, c.z + z), v(c.x - x, y1, c.z + z)],
    [v(c.x + x, y0, c.z - z), v(c.x - x, y0, c.z - z), v(c.x - x, y1, c.z - z), v(c.x + x, y1, c.z - z)],
    [v(c.x + x, y0, c.z + z), v(c.x + x, y0, c.z - z), v(c.x + x, y1, c.z - z), v(c.x + x, y1, c.z + z)],
    [v(c.x - x, y0, c.z - z), v(c.x - x, y0, c.z + z), v(c.x - x, y1, c.z + z), v(c.x - x, y1, c.z - z)],
  ];
}

/** Плотная сетка вместо двух треугольников — как у сгенерированной модели. */
const GRID = 6;
const NOISE = 0.012;

/**
 * Шум привязан к точке, а не к её копии в треугольнике.
 *
 * Первая версия дёргала каждый угол каждого треугольника независимо, и
 * соседние треугольники переставали иметь общие вершины вовсе — такой модели
 * не бывает: экспортёры вершины сваривают. Проверка тогда ловила не свойство
 * разбора, а собственную ошибку.
 */
const jitterCache = new Map<string, THREE.Vector3>();
function jitter(point: THREE.Vector3): THREE.Vector3 {
  const key = `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`;
  let offset = jitterCache.get(key);
  if (!offset) {
    offset = new THREE.Vector3(
      (random() - 0.5) * NOISE,
      (random() - 0.5) * NOISE,
      (random() - 0.5) * NOISE,
    );
    jitterCache.set(key, offset);
  }
  return new THREE.Vector3().addVectors(point, offset);
}

const positions: number[] = [];
const truth: MeshPart[] = [];
const labels: string[] = [];

for (const part of parts) {
  for (const [p0, p1, p2, p3] of part.quads) {
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const corner = (u: number, w: number) =>
          new THREE.Vector3()
            .copy(p0)
            .lerp(p1, u)
            .lerp(new THREE.Vector3().copy(p3).lerp(p2, u), w);
        const a = corner(i / GRID, j / GRID);
        const b = corner((i + 1) / GRID, j / GRID);
        const c = corner((i + 1) / GRID, (j + 1) / GRID);
        const d = corner(i / GRID, (j + 1) / GRID);
        for (const tri of [[a, b, c], [a, c, d]]) {
          for (const point of tri) {
            const moved = jitter(point);
            positions.push(moved.x, moved.y, moved.z);
          }
          truth.push(part.expect);
          labels.push(part.label);
        }
      }
    }
  }
}

/**
 * Второй прогон — на меше без сварки вершин.
 *
 * Экспортёры расходятся: одни отдают общие вершины одной точкой, другие
 * записывают каждый угол треугольника отдельно, и совпадающие точки
 * расходятся в тысячных. Во втором случае поиск соседей по точному
 * совпадению не находит ничего, дом рассыпается на треугольники, и каждый
 * из них по отдельности мал — то есть весь дом уезжает в «мелочь». Отказ
 * тихий, поэтому проверяется отдельно.
 */
const UNWELDED = process.argv.includes("--unwelded");
if (UNWELDED) {
  for (let i = 0; i < positions.length; i++) {
    positions[i] += (random() - 0.5) * 4e-4;
  }
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute(
  "position",
  new THREE.BufferAttribute(new Float32Array(positions), 3),
);
const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
const scene = new THREE.Scene();
scene.add(mesh);

// Порядок треугольников после разбора меняется, поэтому истина сверяется по
// центру треугольника, а не по его номеру.
const centreKey = (x: number, y: number, z: number) =>
  `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
const before = geometry.getAttribute("position");
const expected = new Map<string, { part: MeshPart; label: string }>();
for (let t = 0; t < before.count / 3; t++) {
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < 3; i++) {
    cx += before.getX(t * 3 + i) / 3;
    cy += before.getY(t * 3 + i) / 3;
    cz += before.getZ(t * 3 + i) / 3;
  }
  expected.set(centreKey(cx, cy, cz), { part: truth[t], label: labels[t] });
}

const stats = segmentHouse(scene);

const after = mesh.geometry.getAttribute("position");
const tally = new Map<string, Map<MeshPart, number>>();
let matched = 0;
let wrong = 0;

for (const group of mesh.geometry.groups) {
  const part = MESH_PARTS[group.materialIndex ?? 0];
  for (let t = group.start / 3; t < (group.start + group.count) / 3; t++) {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < 3; i++) {
      cx += after.getX(t * 3 + i) / 3;
      cy += after.getY(t * 3 + i) / 3;
      cz += after.getZ(t * 3 + i) / 3;
    }
    const want = expected.get(centreKey(cx, cy, cz));
    if (!want) continue;
    matched++;
    const row = tally.get(want.label) ?? new Map<MeshPart, number>();
    row.set(part, (row.get(part) ?? 0) + 1);
    tally.set(want.label, row);
    if (part !== want.part) wrong++;
  }
}

console.log(`Меш: ${UNWELDED ? "вершины НЕ сварены" : "вершины сварены"}`);
console.log(`Треугольников: ${before.count / 3}, сверено: ${matched}`);
console.log(`Плоских участков найдено: ${stats.facets}`);
console.log(
  "Доли площади: " +
    MESH_PARTS.map((p) => `${p} ${(stats.share[p] * 100).toFixed(1)}%`).join(", "),
);
console.log("");

let failed = false;
for (const part of parts) {
  const row = tally.get(part.label) ?? new Map<MeshPart, number>();
  const total = [...row.values()].reduce((s, n) => s + n, 0) || 1;
  const hit = row.get(part.expect) ?? 0;
  const share = hit / total;
  const detail = MESH_PARTS.filter((p) => row.get(p))
    .map((p) => `${p} ${row.get(p)}`)
    .join(", ");
  const ok = share >= 0.95;
  if (!ok) failed = true;
  console.log(
    `${ok ? "OK  " : "ПЛОХО"} ${part.label.padEnd(22)} ожидалось ${part.expect.padEnd(6)} → ${detail} (${(share * 100).toFixed(1)}%)`,
  );
}

console.log("");
console.log(`Ошибок классификации: ${wrong} из ${matched}`);
if (failed || wrong / Math.max(matched, 1) > 0.05) {
  console.error("Разбор не проходит проверку.");
  process.exit(1);
}
console.log("Разбор проходит проверку.");
