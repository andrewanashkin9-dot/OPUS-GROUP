"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { productById } from "@/lib/marketplace";
import {
  openingsOnWall,
  roomCorners,
  roomWalls,
  type PlanPoint,
  type RoomModel,
  type RoomOpening,
  type SurfaceId,
} from "@/lib/room";

/** The accent, lifted: on a lit surface pure gold reads dull. */
const SELECTED = "#ffe14d";

/**
 * How see-through a surface is when the camera is on its outside.
 *
 * The dollhouse rule is one rule, not three: a surface the camera is behind
 * goes translucent. Applied to the ceiling and the near walls alike, it also
 * produces the "opaque from inside" behaviour for free — step through the
 * wall and every surface has the camera on its inward side.
 */
const OUTSIDE_OPACITY = 0.16;
const INSIDE_OPACITY = 1;
/** How fast a surface fades as the camera swings past it. */
const FADE_PER_SECOND = 6;

/** Neutral finishes, so an unfinished room still reads as a room. */
const DEFAULT_COLOUR: Record<string, string> = {
  floor: "#b6b1a8",
  wall: "#e8e4dc",
  ceiling: "#f4f2ee",
};

interface RoomSceneProps {
  room: RoomModel;
  selectedSurfaceId: SurfaceId | null;
  onSelect: (id: SurfaceId) => void;
}

/**
 * The room, built from the numbers the reader typed.
 *
 * No furniture: the question on this screen is how much floor and how much
 * wall, and a sofa in the corner answers a different one while making the
 * measurement harder to read.
 */
export function RoomScene({ room, selectedSurfaceId, onSelect }: RoomSceneProps) {
  const walls = useMemo(() => roomWalls(room), [room]);
  const corners = useMemo(() => roomCorners(room), [room]);
  const { heightM } = room.dimensions;

  const slab = useMemo(() => planGeometry(corners), [corners]);

  return (
    <group>
      <Surface
        id="floor"
        geometry={slab}
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        inward={[0, 1, 0]}
        anchor={[0, 0, 0]}
        colour={finishColour(room, "floor", "floor")}
        selected={selectedSurfaceId === "floor"}
        onSelect={onSelect}
      />

      <Surface
        id="ceiling"
        geometry={slab}
        position={[0, heightM, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        inward={[0, -1, 0]}
        anchor={[0, heightM, 0]}
        colour={finishColour(room, "ceiling", "ceiling")}
        selected={selectedSurfaceId === "ceiling"}
        onSelect={onSelect}
      />

      {walls.map((wall) => (
        <Wall
          key={wall.id}
          id={wall.id}
          start={wall.start}
          end={wall.end}
          lengthM={wall.lengthM}
          heightM={wall.heightM}
          rotationY={wall.rotationY}
          inward={[wall.inward.x, 0, wall.inward.z]}
          openings={openingsOnWall(room, wall.id)}
          colour={finishColour(room, wall.id, "wall")}
          selected={selectedSurfaceId === wall.id}
          onSelect={onSelect}
        />
      ))}

      {/* Openings get their own frames rather than being left as holes: a gap
          in a translucent wall is indistinguishable from the wall. */}
      {walls.map((wall) =>
        openingsOnWall(room, wall.id).map((opening) => (
          <OpeningFrame
            key={opening.id}
            opening={opening}
            start={wall.start}
            dir={wall.dir}
            rotationY={wall.rotationY}
          />
        )),
      )}
    </group>
  );
}

// -------------------------------------------------------------- поверхности

interface SurfaceProps {
  id: SurfaceId;
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  rotation: [number, number, number];
  /** Unit normal pointing into the room. */
  inward: [number, number, number];
  /** A point on the surface, for deciding which side the camera is on. */
  anchor: [number, number, number];
  colour: string;
  selected: boolean;
  onSelect: (id: SurfaceId) => void;
}

function Surface({
  id,
  geometry,
  position,
  rotation,
  inward,
  anchor,
  colour,
  selected,
  onSelect,
}: SurfaceProps) {
  const material = useRef<THREE.MeshStandardMaterial>(null);

  // Fades the surface out when the camera passes to its outside.
  //
  // Run per frame rather than on a camera-change listener: with
  // frameloop="demand" a frame is only produced when something moved, so
  // "per frame" already means "when the camera moved" — and the eased value
  // keeps walls from flicking between states as the view swings past their
  // plane. Written inline rather than as a hook because the fade writes to
  // the material through the ref, and a ref handed to a hook as an argument
  // is no longer something the compiler will let anyone write to.
  useFrame(({ camera, invalidate }, delta) => {
    const mat = material.current;
    if (!mat) return;
    const side =
      (camera.position.x - anchor[0]) * inward[0] +
      (camera.position.y - anchor[1]) * inward[1] +
      (camera.position.z - anchor[2]) * inward[2];
    const target = side < 0 ? OUTSIDE_OPACITY : INSIDE_OPACITY;
    const next = THREE.MathUtils.damp(mat.opacity, target, FADE_PER_SECOND, delta);
    if (Math.abs(next - target) > 0.001) {
      mat.opacity = next;
      // On-demand rendering stops the moment nothing asks for a frame, so
      // the fade has to keep asking until it has arrived.
      invalidate();
    } else {
      mat.opacity = target;
    }
  });

  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={rotation}
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(id);
      }}
    >
      <meshStandardMaterial
        ref={material}
        color={selected ? SELECTED : colour}
        emissive={selected ? SELECTED : "#000000"}
        emissiveIntensity={selected ? 0.3 : 0}
        roughness={0.86}
        metalness={0}
        side={THREE.DoubleSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

interface WallProps {
  id: SurfaceId;
  start: PlanPoint;
  end: PlanPoint;
  lengthM: number;
  heightM: number;
  rotationY: number;
  inward: [number, number, number];
  openings: RoomOpening[];
  colour: string;
  selected: boolean;
  onSelect: (id: SurfaceId) => void;
}

function Wall({
  id,
  start,
  end,
  lengthM,
  heightM,
  rotationY,
  inward,
  openings,
  colour,
  selected,
  onSelect,
}: WallProps) {
  const geometry = useMemo(
    () => wallGeometry(lengthM, heightM, openings),
    [lengthM, heightM, openings],
  );
  const mid: [number, number, number] = [
    (start.x + end.x) / 2,
    heightM / 2,
    (start.z + end.z) / 2,
  ];

  return (
    <Surface
      id={id}
      geometry={geometry}
      position={mid}
      rotation={[0, rotationY, 0]}
      inward={inward}
      anchor={mid}
      colour={colour}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

/** A door or window, drawn as the reveal around the hole in the wall. */
function OpeningFrame({
  opening,
  start,
  dir,
  rotationY,
}: {
  opening: RoomOpening;
  start: PlanPoint;
  dir: PlanPoint;
  rotationY: number;
}) {
  const centreU = opening.offsetM + opening.widthM / 2;
  const position: [number, number, number] = [
    start.x + dir.x * centreU,
    opening.sillM + opening.heightM / 2,
    start.z + dir.z * centreU,
  ];
  const pane = useMemo(
    () => new THREE.PlaneGeometry(opening.widthM, opening.heightM),
    [opening.widthM, opening.heightM],
  );
  const outline = useMemo(() => new THREE.EdgesGeometry(pane), [pane]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <lineSegments geometry={outline} raycast={() => null}>
        <lineBasicMaterial
          color={opening.kind === "door" ? "#ffffff" : "#9fc4ff"}
          transparent
          opacity={0.85}
        />
      </lineSegments>
      {/* A window is a pane; a doorway is an empty hole. Which is what each
          of them still is once the finish goes on. */}
      {opening.kind === "window" && (
        <mesh geometry={pane} raycast={() => null}>
          <meshStandardMaterial
            color="#bcd6ff"
            transparent
            opacity={0.2}
            roughness={0.1}
            metalness={0}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

// ------------------------------------------------------------------ helpers

/** The plan polygon as a slab, ready to be rotated flat. */
function planGeometry(corners: PlanPoint[]): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  corners.forEach((corner, i) => {
    // Shape space is XY and the mesh is rotated −90° about X, which maps
    // shape-y onto −world-z; negating here puts the plan back the right way
    // round instead of mirrored.
    if (i === 0) shape.moveTo(corner.x, -corner.z);
    else shape.lineTo(corner.x, -corner.z);
  });
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** One wall face, with its openings cut out as holes. */
function wallGeometry(
  lengthM: number,
  heightM: number,
  openings: RoomOpening[],
): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(lengthM, 0);
  shape.lineTo(lengthM, heightM);
  shape.lineTo(0, heightM);
  shape.closePath();

  for (const o of openings) {
    // An opening that no longer fits is left uncut rather than punched
    // through a corner: the estimate refuses to proceed while one exists,
    // and a hole hanging in space would read as a modelling bug instead of
    // the input error it actually is.
    if (o.offsetM < 0 || o.offsetM + o.widthM > lengthM) continue;
    if (o.sillM < 0 || o.sillM + o.heightM > heightM) continue;
    const hole = new THREE.Path();
    hole.moveTo(o.offsetM, o.sillM);
    hole.lineTo(o.offsetM + o.widthM, o.sillM);
    hole.lineTo(o.offsetM + o.widthM, o.sillM + o.heightM);
    hole.lineTo(o.offsetM, o.sillM + o.heightM);
    hole.closePath();
    shape.holes.push(hole);
  }

  const geometry = new THREE.ShapeGeometry(shape);
  // Built from a corner, because that is where offsets are measured from;
  // centred here, because that is where the mesh is placed.
  geometry.translate(-lengthM / 2, -heightM / 2, 0);
  return geometry;
}

/** The colour a surface renders in: the chosen material's, else a neutral. */
function finishColour(
  room: RoomModel,
  id: SurfaceId,
  kind: "floor" | "wall" | "ceiling",
): string {
  const productId = room.finishes[id];
  const product = productId ? productById(productId) : undefined;
  return product?.photo.tint ?? DEFAULT_COLOUR[kind];
}
