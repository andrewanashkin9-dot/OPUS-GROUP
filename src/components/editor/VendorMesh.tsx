"use client";

import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { materialById } from "@/lib/3d/materials";
import {
  MESH_PARTS,
  segmentHouse,
  type MeshPart,
  type SegmentationStats,
} from "@/lib/3d/mesh-segmentation";
import { createSurfaceTexture } from "@/lib/3d/textures";

/**
 * Модель дома, построенная Neural4D.
 *
 * Она ничего не измеряет и ни на одну цифру в смете не влияет — это
 * похожесть, а не обмеры. Поэтому она подгоняется под габариты, которые
 * ввёл человек: вендор отдаёт меш в своих единицах и со своим центром, и
 * без подгонки он оказался бы то с ноготь, то в полкилометра.
 *
 * Материалы. Меш приходит одним куском без разметки, поэтому части дома
 * восстанавливаются из геометрии (см. mesh-segmentation.ts) и раскладываются
 * по группам. Нетронутые части сохраняют собственный материал вендора — он
 * несёт похожесть на фотографию, ради которой всё и затевалось; заменяется
 * только то, что человек выбрал сам.
 */

export function VendorMesh({
  url,
  widthM,
  depthM,
  materials,
  onSegmented,
}: {
  url: string;
  widthM: number;
  depthM: number;
  /** Выбор человека по частям. Пустое — оставить материал вендора. */
  materials: Partial<Record<MeshPart, string>>;
  onSegmented?: (stats: SegmentationStats) => void;
}) {
  return (
    // Свой файл вендора мы видим впервые: он может не загрузиться, оказаться
    // не тем форматом или слишком тяжёлым. Ни один из этих случаев не должен
    // уносить с собой редактор, поэтому вокруг — граница ошибок, а не
    // надежда на то, что всё пройдёт хорошо.
    <MeshBoundary>
      <Suspense fallback={null}>
        <FittedModel
          url={url}
          widthM={widthM}
          depthM={depthM}
          materials={materials}
          onSegmented={onSegmented}
        />
      </Suspense>
    </MeshBoundary>
  );
}

function FittedModel({
  url,
  widthM,
  depthM,
  materials,
  onSegmented,
}: {
  url: string;
  widthM: number;
  depthM: number;
  materials: Partial<Record<MeshPart, string>>;
  onSegmented?: (stats: SegmentationStats) => void;
}) {
  const { scene } = useGLTF(url);

  // Клон, а не сам загруженный граф: useGLTF кеширует его по адресу, и
  // разбор на части менял бы модель для любого следующего показа —
  // включая повторное открытие того же проекта.
  const { model, stats, originals, scale, offset, hasUv } = useMemo(() => {
    const model = scene.clone(true);
    const stats = segmentHouse(model);

    // Материал вендора запоминается до подмены: части, которых человек не
    // касался, должны остаться такими, какими их построили по фотографии.
    const originals = new Map<THREE.Mesh, THREE.Material>();
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const current = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      originals.set(mesh, current);
    });

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Масштаб по большей стороне плана: так дом занимает ровно то пятно,
    // которое человек задал рулеткой, а пропорции вендора не искажаются.
    const footprint = Math.max(size.x, size.z);
    const scale = footprint > 0 ? Math.max(widthM, depthM) / footprint : 1;

    // Есть ли у модели развёртка — решается один раз здесь: от неё зависит,
    // можно ли вообще класть текстуру.
    let hasUv = false;
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry.getAttribute("uv")) hasUv = true;
    });

    return {
      model,
      stats,
      originals,
      scale,
      hasUv,
      offset: new THREE.Vector3(-center.x * scale, -box.min.y * scale, -center.z * scale),
    };
  }, [scene, widthM, depthM]);

  // Материалы собираются здесь, а не в памоизации выше: выбор меняется
  // чаще, чем загружается модель, и пересобирать разбор ради смены цвета
  // кровли значило бы каждый раз заново обходить десятки тысяч треугольников.
  const built = useMemo(() => {
    const made: (THREE.Material | null)[] = MESH_PARTS.map((part) => {
      const id = materials[part];
      const option = id ? materialById(id) : undefined;
      if (!option) return null;
      const span = Math.max(widthM, depthM);
      // Текстура кладётся только если у меша есть развёртка. У чужого файла
      // её может не быть вовсе, и тогда карта сэмплится в одну точку —
      // поверхность становится равномерным пятном непредсказуемого цвета.
      // Без развёртки честнее показать чистый цвет материала.
      const texture = hasUv
        ? createSurfaceTexture(option.textureId, option.colorHex, span, span)
        : null;
      return new THREE.MeshStandardMaterial({
        map: texture,
        color: option.colorHex,
        roughness: 0.82,
        metalness: 0,
      });
    });
    return made;
  }, [materials, widthM, depthM, hasUv]);

  // Текстуры и материалы держат память видеокарты, и сборщик мусора о ней
  // не знает: без явного освобождения каждая смена материала оставляла бы
  // после себя предыдущий.
  useEffect(
    () => () => {
      for (const material of built) {
        if (!material) continue;
        const map = (material as THREE.MeshStandardMaterial).map;
        map?.dispose();
        material.dispose();
      }
    },
    [built],
  );

  useEffect(() => {
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const original = originals.get(mesh);
      mesh.material = MESH_PARTS.map(
        (_, index) => built[index] ?? original ?? new THREE.MeshStandardMaterial(),
      );
    });
  }, [model, originals, built]);

  useEffect(() => onSegmented?.(stats), [stats, onSegmented]);

  return (
    <group scale={scale} position={offset}>
      <primitive object={model} />
    </group>
  );
}

/**
 * Граница ошибок для загрузки чужого файла.
 *
 * Классовый компонент здесь не по старой памяти: перехватывать ошибки
 * рендера в React умеют только они, хука для этого нет.
 */
class MeshBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[neural4d] модель не удалось показать:", error);
  }

  render() {
    // Молча: дом-схема на экране уже есть, и подменять его сообщением об
    // ошибке посреди сцены незачем. Причина — в консоли.
    return this.state.failed ? null : this.props.children;
  }
}
