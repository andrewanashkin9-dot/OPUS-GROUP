"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  FENCE_HEIGHT_M,
  PLOT_SCALE,
  WALL_THICKNESS_M,
  facadeSpanM,
} from "@/lib/3d/metrics";
import {
  createRoofGeometry,
  endWallProfile,
  roofDimensions,
} from "@/lib/3d/roof-geometry";
import {
  createSurfaceMaterial,
  disposeSurfaceMaterial,
} from "@/lib/3d/surface-material";
import { materialById } from "@/lib/3d/materials";
import type {
  Facade,
  Opening,
  SceneModel,
  SceneNode,
  TextureId,
} from "@/lib/3d/types";
import { styleDef } from "@/lib/3d/styles";
import { effectiveColor } from "@/lib/store";
import {
  Chimney,
  Deck,
  Drainage,
  Porch,
  Quoins,
  RoofTrim,
  Shutters,
  StringCourses,
  useRoofDims,
} from "./HouseDetails";

/** The accent, lifted a little: on a lit surface pure gold reads dull. */
const SELECTED = "#ffe14d";

interface HouseSceneProps {
  model: SceneModel;
  selectedNodeId: string | null;
  colorOverrides: Record<string, string>;
  onSelect: (nodeId: string) => void;
}

/**
 * Builds the demo house from the SceneModel. The node ids it reads are the
 * ones MockModel3DProvider emits; a real vendor scene would arrive with its
 * own meshes and this component would render those instead.
 */
export function HouseScene({
  model,
  selectedNodeId,
  colorOverrides,
  onSelect,
}: HouseSceneProps) {
  const { widthM, depthM } = model.dimensions;
  const style = styleDef(model.style);
  const roofDims = useRoofDims(model);
  const node = (id: string) => model.nodes.find((n) => n.id === id);

  const handle =
    (nodeId: string) =>
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(nodeId);
    };

  const roofNode = node("node-roof");
  const foundation = node("node-foundation");
  const fence = node("node-fence");
  const windowNode = node("node-windows");
  const doorNode = node("node-door");

  const facades: { facade: Facade; node?: SceneNode }[] = [
    { facade: "front", node: node("node-facade-front") },
    { facade: "back", node: node("node-facade-back") },
    { facade: "left", node: node("node-facade-left") },
    { facade: "right", node: node("node-facade-right") },
  ];

  return (
    <group>
      {foundation && (
        <TexturedBox
          node={foundation}
          colorOverrides={colorOverrides}
          selected={selectedNodeId === foundation.id}
          onClick={handle(foundation.id)}
          position={[0, 0.3, 0]}
          size={[widthM + 0.34, 0.8, depthM + 0.34]}
          surface={[widthM, 0.8]}
        />
      )}

      {facades.map(({ facade, node: facadeNode }) =>
        facadeNode ? (
          <FacadeWall
            key={facade}
            facade={facade}
            node={facadeNode}
            model={model}
            colorOverrides={colorOverrides}
            selected={selectedNodeId === facadeNode.id}
            onClick={handle(facadeNode.id)}
          />
        ) : null,
      )}

      {/* The gable triangle continues the wall beneath it, so each end takes
          its own elevation's material — a wood gable stays wood all the way
          up, rather than turning into whatever the front is clad in. */}
      {(roofNode?.roof?.shape === "gable" ||
        roofNode?.roof?.shape === "mansard") && (
        <GableEnds
          model={model}
          leftNode={node("node-facade-left")}
          rightNode={node("node-facade-right")}
          colorOverrides={colorOverrides}
        />
      )}

      {roofNode?.roof && (
        <Roof
          node={roofNode}
          model={model}
          colorOverrides={colorOverrides}
          selected={selectedNodeId === roofNode.id}
          onClick={handle(roofNode.id)}
        />
      )}

      {model.openings.map((opening) =>
        opening.kind === "window"
          ? windowNode && (
              <WindowUnit
                key={opening.id}
                opening={opening}
                node={windowNode}
                model={model}
                colorOverrides={colorOverrides}
                selected={selectedNodeId === windowNode.id}
                onClick={handle(windowNode.id)}
              />
            )
          : doorNode && (
              <DoorUnit
                key={opening.id}
                opening={opening}
                node={doorNode}
                model={model}
                colorOverrides={colorOverrides}
                selected={selectedNodeId === doorNode.id}
                onClick={handle(doorNode.id)}
              />
            ),
      )}

      {fence && (
        <FenceRing
          node={fence}
          colorOverrides={colorOverrides}
          selected={selectedNodeId === fence.id}
          onClick={handle(fence.id)}
          width={widthM * PLOT_SCALE}
          depth={depthM * PLOT_SCALE}
        />
      )}

      <StringCourses model={model} style={style} />
      <Quoins model={model} style={style} />
      <Shutters model={model} style={style} openings={model.openings} />
      <Porch model={model} style={style} openings={model.openings} />
      <Deck model={model} style={style} />
      {roofDims && (
        <>
          <RoofTrim model={model} style={style} dims={roofDims} />
          <Drainage model={model} style={style} dims={roofDims} />
          <Chimney model={model} style={style} dims={roofDims} />
        </>
      )}
    </group>
  );
}

/**
 * Материал поверхности, живущий ровно столько, сколько нужен.
 *
 * Раньше здесь строилась одна карта цвета, и все поверхности отражали свет
 * одинаково — смена материала читалась как смена оттенка. Теперь материал
 * собирается целиком: цвет, рельеф и своя шершавость на каждый вид отделки
 * (см. surface-material.ts).
 */
function useSurfaceMaterial(
  textureId: TextureId,
  color: string,
  widthM: number,
  heightM: number,
  doubleSided = false,
) {
  const material = useMemo(
    () => createSurfaceMaterial(textureId, color, widthM, heightM, { doubleSided }),
    [textureId, color, widthM, heightM, doubleSided],
  );
  useEffect(() => () => disposeSurfaceMaterial(material), [material]);
  return material;
}

function textureOf(node: SceneNode): TextureId {
  return materialById(node.materialId)?.textureId ?? "plaster";
}

function TexturedBox({
  node,
  colorOverrides,
  selected,
  onClick,
  position,
  size,
  surface,
  rotation,
}: {
  node: SceneNode;
  colorOverrides: Record<string, string>;
  selected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  position: [number, number, number];
  size: [number, number, number];
  surface: [number, number];
  rotation?: [number, number, number];
}) {
  const color = effectiveColor(node, colorOverrides);
  const material = useSurfaceMaterial(textureOf(node), color, surface[0], surface[1]);
  return (
    <mesh position={position} rotation={rotation} onClick={onClick} material={material}>
      <boxGeometry args={size} />
      {selected && <SelectionEdges size={size} />}
    </mesh>
  );
}

/** Outlines a box of the given size — must match the mesh it sits inside. */
function SelectionEdges({ size }: { size: [number, number, number] }) {
  const geometry = useMemo(
    () => new THREE.BoxGeometry(size[0], size[1], size[2]),
    [size],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments>
      <edgesGeometry args={[geometry]} />
      <lineBasicMaterial color={SELECTED} />
    </lineSegments>
  );
}

function FacadeWall({
  facade,
  node,
  model,
  colorOverrides,
  selected,
  onClick,
}: {
  facade: Facade;
  node: SceneNode;
  model: SceneModel;
  colorOverrides: Record<string, string>;
  selected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { widthM, depthM, heightM } = model.dimensions;
  const span = facadeSpanM(model.dimensions, facade);
  const t = WALL_THICKNESS_M;

  const placement: Record<
    Facade,
    { position: [number, number, number]; size: [number, number, number] }
  > = {
    front: {
      position: [0, heightM / 2, depthM / 2 - t / 2],
      size: [widthM, heightM, t],
    },
    back: {
      position: [0, heightM / 2, -depthM / 2 + t / 2],
      size: [widthM, heightM, t],
    },
    left: {
      position: [-widthM / 2 + t / 2, heightM / 2, 0],
      size: [t, heightM, depthM],
    },
    right: {
      position: [widthM / 2 - t / 2, heightM / 2, 0],
      size: [t, heightM, depthM],
    },
  };

  const { position, size } = placement[facade];
  return (
    <TexturedBox
      node={node}
      colorOverrides={colorOverrides}
      selected={selected}
      onClick={onClick}
      position={position}
      size={size}
      surface={[span, heightM]}
    />
  );
}

/** The wall closing each end of a ridged roof, built up to the roof underside. */
function GableEnds({
  model,
  leftNode,
  rightNode,
  colorOverrides,
}: {
  model: SceneModel;
  leftNode?: SceneNode;
  rightNode?: SceneNode;
  colorOverrides: Record<string, string>;
}) {
  const { widthM, depthM, heightM } = model.dimensions;
  const roof = model.nodes.find((n) => n.roof)?.roof;

  const geometry = useMemo(() => {
    if (!roof) return null;
    const dims = roofDimensions(
      widthM,
      depthM,
      roof.overhangM,
      roof.pitchDeg,
      roof.shape,
    );
    const shape = new THREE.Shape(
      endWallProfile(roof.shape, dims, depthM / 2),
    );
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: WALL_THICKNESS_M,
      bevelEnabled: false,
    });
    geo.rotateY(-Math.PI / 2);
    return geo;
  }, [widthM, depthM, roof]);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry || !roof) return null;

  const t = WALL_THICKNESS_M;
  // Each end sits in the same slab of space as the wall it continues upward.
  return (
    <>
      {rightNode && (
        <GableEndMesh
          geometry={geometry}
          node={rightNode}
          colorOverrides={colorOverrides}
          position={[widthM / 2, heightM, 0]}
          surface={[depthM, heightM]}
        />
      )}
      {leftNode && (
        <GableEndMesh
          geometry={geometry}
          node={leftNode}
          colorOverrides={colorOverrides}
          position={[-widthM / 2 + t, heightM, 0]}
          surface={[depthM, heightM]}
        />
      )}
    </>
  );
}

function GableEndMesh({
  geometry,
  node,
  colorOverrides,
  position,
  surface,
}: {
  geometry: THREE.BufferGeometry;
  node: SceneNode;
  colorOverrides: Record<string, string>;
  position: [number, number, number];
  surface: [number, number];
}) {
  const color = effectiveColor(node, colorOverrides);
  const material = useSurfaceMaterial(textureOf(node), color, surface[0], surface[1]);
  return <mesh geometry={geometry} position={position} material={material} />;
}

function Roof({
  node,
  model,
  colorOverrides,
  selected,
  onClick,
}: {
  node: SceneNode;
  model: SceneModel;
  colorOverrides: Record<string, string>;
  selected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { widthM, depthM, heightM } = model.dimensions;
  const roof = node.roof!;
  const dims = useMemo(
    () =>
      roofDimensions(widthM, depthM, roof.overhangM, roof.pitchDeg, roof.shape),
    [widthM, depthM, roof.overhangM, roof.pitchDeg, roof.shape],
  );

  const geometry = useMemo(
    () => createRoofGeometry(roof.shape, dims),
    [roof.shape, dims],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  const color = effectiveColor(node, colorOverrides);
  const slopeLength = Math.hypot(dims.halfDepth, dims.rise) * 2;
  const material = useSurfaceMaterial(
    textureOf(node),
    color,
    dims.halfWidth * 2,
    slopeLength,
    // Скат — открытая плоскость без толщины, и снизу, из-под свеса, на неё
    // смотрят с изнанки.
    true,
  );

  return (
    <group position={[0, heightM, 0]}>
      <mesh geometry={geometry} onClick={onClick} material={material} />
      {selected && (
        <lineSegments>
          <edgesGeometry args={[geometry]} />
          <lineBasicMaterial color={SELECTED} />
        </lineSegments>
      )}
    </group>
  );
}

/** Where an opening sits in world space, and which way it faces. */
function openingTransform(model: SceneModel, opening: Opening) {
  const { widthM, depthM } = model.dimensions;
  const y = opening.sillM + opening.heightM / 2;
  const out = 0.02;
  switch (opening.facade) {
    case "front":
      return {
        position: [opening.offsetM, y, depthM / 2 + out] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
      };
    case "back":
      return {
        position: [opening.offsetM, y, -depthM / 2 - out] as [number, number, number],
        rotation: [0, Math.PI, 0] as [number, number, number],
      };
    case "left":
      return {
        position: [-widthM / 2 - out, y, opening.offsetM] as [number, number, number],
        rotation: [0, -Math.PI / 2, 0] as [number, number, number],
      };
    case "right":
      return {
        position: [widthM / 2 + out, y, opening.offsetM] as [number, number, number],
        rotation: [0, Math.PI / 2, 0] as [number, number, number],
      };
  }
}

function WindowUnit({
  opening,
  node,
  model,
  colorOverrides,
  selected,
  onClick,
}: {
  opening: Opening;
  node: SceneNode;
  model: SceneModel;
  colorOverrides: Record<string, string>;
  selected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { position, rotation } = openingTransform(model, opening);
  const frameColor = effectiveColor(node, colorOverrides);
  const { widthM: w, heightM: h } = opening;
  const frame = 0.09;

  return (
    <group position={position} rotation={rotation} onClick={onClick}>
      {/* Reveal: the dark opening behind the glass. */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[w, h, 0.02]} />
        <meshStandardMaterial color="#0a0a0a" roughness={1} />
      </mesh>

      {/* Glass, tinted and slightly reflective. */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[w - frame * 2, h - frame * 2]} />
        <meshStandardMaterial
          color="#7f95a3"
          roughness={0.08}
          metalness={0.55}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Frame: four bars plus a central mullion. */}
      <FrameBars w={w} h={h} thickness={frame} color={frameColor} />
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[frame * 0.7, h - frame * 2, 0.05]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>

      {/* Sill */}
      <mesh position={[0, -h / 2 - 0.04, 0.04]}>
        <boxGeometry args={[w + 0.16, 0.06, 0.16]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} />
      </mesh>

      {selected && (
        <lineSegments position={[0, 0, 0.03]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(w + 0.12, h + 0.12)]} />
          <lineBasicMaterial color={SELECTED} />
        </lineSegments>
      )}
    </group>
  );
}

function FrameBars({
  w,
  h,
  thickness,
  color,
}: {
  w: number;
  h: number;
  thickness: number;
  color: string;
}) {
  const bars: { pos: [number, number, number]; size: [number, number, number] }[] =
    [
      { pos: [0, h / 2 - thickness / 2, 0], size: [w, thickness, 0.07] },
      { pos: [0, -h / 2 + thickness / 2, 0], size: [w, thickness, 0.07] },
      { pos: [-w / 2 + thickness / 2, 0, 0], size: [thickness, h, 0.07] },
      { pos: [w / 2 - thickness / 2, 0, 0], size: [thickness, h, 0.07] },
    ];
  return (
    <>
      {bars.map((bar, i) => (
        <mesh key={i} position={bar.pos}>
          <boxGeometry args={bar.size} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      ))}
    </>
  );
}

function DoorUnit({
  opening,
  node,
  model,
  colorOverrides,
  selected,
  onClick,
}: {
  opening: Opening;
  node: SceneNode;
  model: SceneModel;
  colorOverrides: Record<string, string>;
  selected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { position, rotation } = openingTransform(model, opening);
  const color = effectiveColor(node, colorOverrides);
  const { widthM: w, heightM: h } = opening;
  const material = useSurfaceMaterial(textureOf(node), color, w, h);

  return (
    <group position={position} rotation={rotation} onClick={onClick}>
      {/* Door leaf */}
      <mesh position={[0, 0, -0.02]} material={material}>
        <boxGeometry args={[w, h, 0.09]} />
      </mesh>

      {/* Surround */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[w + 0.16, h + 0.1, 0.06]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>

      {/* Handle */}
      <mesh position={[w / 2 - 0.16, 0, 0.05]}>
        <boxGeometry args={[0.05, 0.28, 0.05]} />
        <meshStandardMaterial color="#C9C4BA" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Threshold step */}
      <mesh position={[0, -h / 2 - 0.09, 0.22]}>
        <boxGeometry args={[w + 0.7, 0.18, 0.6]} />
        <meshStandardMaterial color="#6B6660" roughness={0.9} />
      </mesh>

      {selected && (
        <lineSegments position={[0, 0, 0.06]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(w + 0.2, h + 0.16)]} />
          <lineBasicMaterial color={SELECTED} />
        </lineSegments>
      )}
    </group>
  );
}

function FenceRing({
  node,
  colorOverrides,
  selected,
  onClick,
  width,
  depth,
}: {
  node: SceneNode;
  colorOverrides: Record<string, string>;
  selected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  width: number;
  depth: number;
}) {
  const color = effectiveColor(node, colorOverrides);
  const h = FENCE_HEIGHT_M;
  const long = useSurfaceMaterial(textureOf(node), color, width, h);
  const short = useSurfaceMaterial(textureOf(node), color, depth, h);

  return (
    <group>
      {[depth / 2, -depth / 2].map((z, i) => (
        <mesh key={`h-${i}`} position={[0, h / 2 - 0.5, z]} onClick={onClick} material={long}>
          <boxGeometry args={[width, h, 0.08]} />
          {selected && <SelectionEdges size={[width, h, 0.08]} />}
        </mesh>
      ))}
      {[width / 2, -width / 2].map((x, i) => (
        <mesh key={`v-${i}`} position={[x, h / 2 - 0.5, 0]} onClick={onClick} material={short}>
          <boxGeometry args={[0.08, h, depth]} />
          {selected && <SelectionEdges size={[0.08, h, depth]} />}
        </mesh>
      ))}
    </group>
  );
}

