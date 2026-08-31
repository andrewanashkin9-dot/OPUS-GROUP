"use client";

import { useGLTF } from "@react-three/drei";
import { Component, Suspense, type ReactNode } from "react";
import * as THREE from "three";

/**
 * Модель дома, построенная Neural4D.
 *
 * Она ничего не измеряет и ни на одну цифру в смете не влияет — это
 * похожесть, а не обмеры. Поэтому она подгоняется под габариты, которые
 * ввёл человек: вендор отдаёт меш в своих единицах и со своим центром, и
 * без подгонки он оказался бы то с ноготь, то в полкилометра.
 */

export function VendorMesh({
  url,
  widthM,
  depthM,
}: {
  url: string;
  widthM: number;
  depthM: number;
}) {
  return (
    // Свой файл вендора мы видим впервые: он может не загрузиться, оказаться
    // не тем форматом или battle-тяжёлым. Ни один из этих случаев не должен
    // уносить с собой редактор, поэтому вокруг — граница ошибок, а не
    // надежда на то, что всё пройдёт хорошо.
    <MeshBoundary>
      <Suspense fallback={null}>
        <FittedModel url={url} widthM={widthM} depthM={depthM} />
      </Suspense>
    </MeshBoundary>
  );
}

function FittedModel({
  url,
  widthM,
  depthM,
}: {
  url: string;
  widthM: number;
  depthM: number;
}) {
  const { scene } = useGLTF(url);

  // Клон, а не сам загруженный граф: useGLTF кеширует его по адресу, и
  // правка масштаба на месте испортила бы модель для любого следующего
  // показа — включая повторное открытие того же проекта.
  const model = scene.clone(true);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Масштаб по большей стороне плана: так дом занимает ровно то пятно,
  // которое человек задал рулеткой, а пропорции вендора не искажаются.
  const footprint = Math.max(size.x, size.z);
  const scale = footprint > 0 ? Math.max(widthM, depthM) / footprint : 1;

  return (
    <group scale={scale} position={[-center.x * scale, -box.min.y * scale, -center.z * scale]}>
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
