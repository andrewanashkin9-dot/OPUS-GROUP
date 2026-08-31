import * as THREE from "three";

/**
 * Разбор чужого меша на части дома: кровля, стены, мелочь.
 *
 * Зачем это вообще нужно. Модель от Neural4D приходит одним куском без
 * всякой разметки: ни имён, ни материалов, ни групп — сплошная лента
 * треугольников. Поменять на ней «материал кровли» нельзя, пока неизвестно,
 * где кровля. Разметку приходится восстанавливать из самой геометрии.
 *
 * Почему одного угла наклона мало. Козырёк над входом лежит под тем же
 * углом, что и скат крыши, — по углу он неотличим от кровли, и покраска
 * кровли перекрашивала бы его вместе с ней. Поэтому решение принимается по
 * двум признакам сразу: наклон говорит, *чем* поверхность могла бы быть, а
 * её размер — достаточно ли она велика, чтобы быть несущей частью дома.
 *
 * Порог размера задаётся не в метрах, а долей от габарита модели: вендор
 * отдаёт меш в своих единицах, и абсолютные числа здесь означали бы, что
 * разбор работает только для домов определённого размера.
 */

export type MeshPart = "roof" | "wall" | "minor";

/** Порядок важен: он же порядок материалов в массиве у меша. */
export const MESH_PARTS: MeshPart[] = ["roof", "wall", "minor"];

export interface SegmentationStats {
  /** Сколько плоских участков нашлось до классификации. */
  facets: number;
  /** Площадь каждой категории в единицах модели. */
  area: Record<MeshPart, number>;
  /** Доля площади — по ней видно, не съела ли одна категория всё. */
  share: Record<MeshPart, number>;
}

/**
 * Треугольники сшиваются в один участок, пока их нормали расходятся не
 * больше, чем на этот угол.
 *
 * Двадцать градусов — компромисс. Меньше — и слегка неровный скат
 * сгенерированной модели рассыпается на десятки кусочков. Больше — и обход
 * уползает за угол дома: каждый шаг в пределах допуска, а сумма шагов
 * разворачивает нормаль на все девяносто. От этого спасает не только сам
 * допуск, но и сравнение со средней нормалью участка (см. ниже).
 */
const FACET_ANGLE_TOLERANCE = THREE.MathUtils.degToRad(20);

/**
 * Граница между «крышей» и «стеной» по наклону.
 *
 * Шестьдесят градусов от вертикали: всё, что круче, — стена, положе —
 * кровля. Плоская кровля попадает в кровлю, мансардный излом — тоже.
 */
const WALL_SLOPE = THREE.MathUtils.degToRad(60);

/**
 * Насколько крупным должен быть участок, чтобы считаться частью дома.
 *
 * Сравнивается характерный размер участка (корень из площади) с наибольшим
 * габаритом модели. При доме шириной десять метров порог — около двух с
 * половиной: скат и стена его проходят, козырёк и труба — нет.
 */
const MAJOR_SIZE_RATIO = 0.22;

/**
 * Размечает меш и раскладывает треугольники по группам материалов.
 *
 * Меняет геометрию на месте: треугольники переставляются так, чтобы каждая
 * категория лежала подряд, и на них выставляются `geometry.groups` с
 * индексами материалов в порядке MESH_PARTS. Вызывающему остаётся присвоить
 * мешу массив из трёх материалов.
 */
export function segmentHouse(root: THREE.Object3D): SegmentationStats {
  const meshes: THREE.Mesh[] = [];
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh);
  });

  // Габарит считается по всей модели, а не по отдельному мешу: труба —
  // самостоятельный меш, и относительно самой себя она огромна.
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = Math.max(size.x, size.y, size.z);
  const minorLimit = (MAJOR_SIZE_RATIO * scale) ** 2;

  const area: Record<MeshPart, number> = { roof: 0, wall: 0, minor: 0 };
  let facets = 0;

  for (const mesh of meshes) {
    const result = segmentMesh(mesh, minorLimit);
    facets += result.facets;
    for (const part of MESH_PARTS) area[part] += result.area[part];
  }

  const total = area.roof + area.wall + area.minor || 1;
  return {
    facets,
    area,
    share: {
      roof: area.roof / total,
      wall: area.wall / total,
      minor: area.minor / total,
    },
  };
}

function segmentMesh(mesh: THREE.Mesh, minorLimit: number) {
  // Без индекса каждый треугольник владеет своими вершинами, и переставлять
  // их можно блоками по три, не пересобирая индекс.
  const geometry = mesh.geometry.index
    ? mesh.geometry.toNonIndexed()
    : mesh.geometry;
  const position = geometry.getAttribute("position");
  const triangles = position.count / 3;

  const matrix = mesh.matrixWorld;
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);

  const normals: THREE.Vector3[] = [];
  const areas = new Float64Array(triangles);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();

  for (let t = 0; t < triangles; t++) {
    a.fromBufferAttribute(position, t * 3).applyMatrix4(matrix);
    b.fromBufferAttribute(position, t * 3 + 1).applyMatrix4(matrix);
    c.fromBufferAttribute(position, t * 3 + 2).applyMatrix4(matrix);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    const cross = new THREE.Vector3().crossVectors(ab, ac);
    areas[t] = cross.length() / 2;
    normals.push(cross.normalize().applyMatrix3(normalMatrix).normalize());
  }

  const adjacency = buildAdjacency(position, matrix, triangles);
  const facetOf = growFacets(triangles, normals, areas, adjacency);

  // Площадь и средняя нормаль каждого участка.
  const facetArea = new Map<number, number>();
  const facetNormal = new Map<number, THREE.Vector3>();
  for (let t = 0; t < triangles; t++) {
    const id = facetOf[t];
    facetArea.set(id, (facetArea.get(id) ?? 0) + areas[t]);
    const sum = facetNormal.get(id) ?? new THREE.Vector3();
    facetNormal.set(id, sum.addScaledVector(normals[t], areas[t]));
  }

  const partOfFacet = new Map<number, MeshPart>();
  for (const [id, sum] of facetNormal) {
    partOfFacet.set(id, classify(sum.normalize(), facetArea.get(id) ?? 0, minorLimit));
  }

  const partOf: MeshPart[] = [];
  const area: Record<MeshPart, number> = { roof: 0, wall: 0, minor: 0 };
  for (let t = 0; t < triangles; t++) {
    const part = partOfFacet.get(facetOf[t]) ?? "minor";
    partOf.push(part);
    area[part] += areas[t];
  }

  regroup(geometry, partOf);

  // Нормали — не украшение: без них MeshStandardMaterial не освещается вовсе
  // и модель выходит чёрной. Чужой файл может прийти без них (у glTF это
  // допустимо: спецификация разрешает считать их плоскими), поэтому если их
  // нет — считаем сами. Перестановка треугольников выше нормали не портит:
  // атрибуты переставляются вместе с позициями.
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();

  mesh.geometry = geometry;

  return { facets: facetArea.size, area };
}

/**
 * Классификация участка.
 *
 * Сначала размер, потом угол — и порядок здесь смысловой, а не случайный.
 * Козырёк лежит под углом ската и по углу от кровли неотличим; отсечь его
 * можно только тем, что он мал. Поэтому размер решает первым.
 */
function classify(normal: THREE.Vector3, area: number, minorLimit: number): MeshPart {
  if (area < minorLimit) return "minor";
  // Наклон считается от вертикали: 0 — горизонтальная площадка, 90 — стена.
  const slope = Math.acos(THREE.MathUtils.clamp(Math.abs(normal.y), -1, 1));
  if (slope >= WALL_SLOPE) return "wall";
  // Крупная горизонтальная поверхность, смотрящая вниз, — это низ модели, а
  // не кровля: перекрашивать её вместе с крышей было бы странно.
  return normal.y > 0 ? "roof" : "minor";
}

/**
 * Соседство треугольников по общему ребру.
 *
 * Вершины округляются перед сравнением: у сгенерированной модели совпадающие
 * точки совпадают не побитово, и точное сравнение оставило бы дом рассыпанным
 * на отдельные треугольники.
 *
 * Шаг округления подбирается, а не берётся один раз, и это не
 * перестраховка. Экспортёры расходятся: одни варят вершины и совпадение
 * точное, другие отдают ленту треугольников, где общий угол записан трижды
 * с расхождением в тысячные. При слишком мелком шаге во втором случае
 * соседей не находится вовсе — и весь дом уходит в «мелочь», потому что
 * каждый треугольник по отдельности мал. Такой отказ тихий и выглядит как
 * «разбор не работает», поэтому шаг увеличивается, пока связность не
 * появится.
 */
function buildAdjacency(
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  matrix: THREE.Matrix4,
  triangles: number,
): number[][] {
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  const world: THREE.Vector3[] = [];
  for (let i = 0; i < position.count; i++) {
    const p = point.fromBufferAttribute(position, i).applyMatrix4(matrix).clone();
    world.push(p);
    box.expandByPoint(p);
  }
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z) || 1;

  // Достаточной считается связность, при которой у треугольника в среднем
  // есть хотя бы полтора соседа: у замкнутой поверхности их три.
  const ENOUGH = 1.5;
  let best: number[][] = Array.from({ length: triangles }, () => []);

  for (const ratio of [1e-4, 1e-3, 5e-3, 2e-2]) {
    const adjacency = adjacencyAtGrain(world, triangles, span * ratio);
    const degree =
      adjacency.reduce((sum, list) => sum + list.length, 0) / Math.max(triangles, 1);
    best = adjacency;
    if (degree >= ENOUGH) break;
  }
  return best;
}

function adjacencyAtGrain(
  world: THREE.Vector3[],
  triangles: number,
  grain: number,
): number[][] {
  const step = grain || 1e-6;
  const key = (v: THREE.Vector3) =>
    `${Math.round(v.x / step)},${Math.round(v.y / step)},${Math.round(v.z / step)}`;

  const edges = new Map<string, number[]>();
  for (let t = 0; t < triangles; t++) {
    const k = [key(world[t * 3]), key(world[t * 3 + 1]), key(world[t * 3 + 2])];
    for (let i = 0; i < 3; i++) {
      const edge = [k[i], k[(i + 1) % 3]].sort().join("|");
      const bucket = edges.get(edge);
      if (bucket) bucket.push(t);
      else edges.set(edge, [t]);
    }
  }

  const adjacency: number[][] = Array.from({ length: triangles }, () => []);
  for (const bucket of edges.values()) {
    if (bucket.length < 2) continue;
    for (const t of bucket) {
      for (const other of bucket) if (other !== t) adjacency[t].push(other);
    }
  }
  return adjacency;
}

/**
 * Сшивает треугольники в плоские участки обходом в ширину.
 *
 * Кандидат сравнивается и с соседом, и со средней нормалью уже собранного
 * участка. Только сосед — и обход уполз бы вокруг дома по чуть-чуть; только
 * средняя — и слегка изогнутый скат разорвался бы посередине.
 */
function growFacets(
  triangles: number,
  normals: THREE.Vector3[],
  areas: Float64Array,
  adjacency: number[][],
): Int32Array {
  const facetOf = new Int32Array(triangles).fill(-1);
  const limit = Math.cos(FACET_ANGLE_TOLERANCE);
  let next = 0;

  for (let seed = 0; seed < triangles; seed++) {
    if (facetOf[seed] !== -1) continue;
    const id = next++;
    facetOf[seed] = id;

    const mean = normals[seed].clone().multiplyScalar(areas[seed]);
    const meanUnit = normals[seed].clone();
    const queue = [seed];

    while (queue.length > 0) {
      const current = queue.pop() as number;
      for (const other of adjacency[current]) {
        if (facetOf[other] !== -1) continue;
        if (normals[other].dot(normals[current]) < limit) continue;
        if (normals[other].dot(meanUnit) < limit) continue;
        facetOf[other] = id;
        mean.addScaledVector(normals[other], areas[other]);
        meanUnit.copy(mean).normalize();
        queue.push(other);
      }
    }
  }

  return facetOf;
}

/**
 * Переставляет треугольники так, чтобы каждая категория лежала подряд, и
 * размечает геометрию группами материалов.
 *
 * Группы — единственный способ дать одному мешу несколько материалов, а
 * группа обязана быть непрерывным отрезком, отсюда и перестановка.
 */
function regroup(geometry: THREE.BufferGeometry, partOf: MeshPart[]): void {
  const order: number[] = [];
  const counts: number[] = [];
  for (const part of MESH_PARTS) {
    const before = order.length;
    for (let t = 0; t < partOf.length; t++) if (partOf[t] === part) order.push(t);
    counts.push(order.length - before);
  }

  for (const name of Object.keys(geometry.attributes)) {
    const attribute = geometry.getAttribute(name);
    const size = attribute.itemSize;
    const source = attribute.array as ArrayLike<number>;
    const target = new Float32Array(source.length);
    for (let i = 0; i < order.length; i++) {
      for (let corner = 0; corner < 3; corner++) {
        const from = (order[i] * 3 + corner) * size;
        const to = (i * 3 + corner) * size;
        for (let c = 0; c < size; c++) target[to + c] = source[from + c];
      }
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(target, size));
  }

  geometry.clearGroups();
  let start = 0;
  counts.forEach((count, index) => {
    if (count > 0) geometry.addGroup(start, count * 3, index);
    start += count * 3;
  });
}

/**
 * Вторая развёртка — проекцией по осям, с координатой в метрах.
 *
 * Своя развёртка у чужого меша есть, но она сделана под текстуру вендора:
 * фотография дома, натянутая на модель. Наш кирпич по ней лёг бы растянутым
 * в одном месте и сплюснутым в другом — узор жил бы своей жизнью, и смена
 * материала читалась бы как смена цвета, а не как другой материал.
 *
 * Поэтому строится вторая: каждый треугольник проецируется на ту плоскость,
 * к которой он ближе всего лежит — стена на вертикальную, кровля на
 * горизонтальную. Координата равна метру сцены, поэтому кирпич везде одного
 * размера, независимо от того, какую поверхность им кроют.
 *
 * Записывается в `uv1`, а не поверх `uv`: исходная развёртка нужна тем
 * частям, которые человек не трогал — они остаются с материалом вендора.
 */
export function projectMetreUv(root: THREE.Object3D, scale: number): void {
  root.updateWorldMatrix(true, true);

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    const geometry = mesh.geometry;
    const position = geometry.getAttribute("position");
    if (!position) return;

    const matrix = mesh.matrixWorld;
    const uv = new Float32Array((position.count / 3) * 3 * 2);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const corner = new THREE.Vector3();

    for (let t = 0; t < position.count / 3; t++) {
      a.fromBufferAttribute(position, t * 3).applyMatrix4(matrix);
      b.fromBufferAttribute(position, t * 3 + 1).applyMatrix4(matrix);
      c.fromBufferAttribute(position, t * 3 + 2).applyMatrix4(matrix);
      normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).normalize();

      // Ось, вдоль которой поверхность «смотрит» сильнее всего: по ней и
      // выбирается плоскость проекции. Для стены это X или Z, для кровли Y.
      const ax = Math.abs(normal.x);
      const ay = Math.abs(normal.y);
      const az = Math.abs(normal.z);
      const axis = ay >= ax && ay >= az ? 1 : ax >= az ? 0 : 2;

      for (let i = 0; i < 3; i++) {
        corner.fromBufferAttribute(position, t * 3 + i).applyMatrix4(matrix);
        corner.multiplyScalar(scale);
        const u = axis === 0 ? corner.z : corner.x;
        const v = axis === 1 ? corner.z : corner.y;
        uv[(t * 3 + i) * 2] = u;
        uv[(t * 3 + i) * 2 + 1] = v;
      }
    }

    geometry.setAttribute("uv1", new THREE.BufferAttribute(uv, 2));
  });
}
