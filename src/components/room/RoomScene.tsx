"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { productById, type Product } from "@/lib/marketplace";
import {
  openingsOnWall,
  roomCorners,
  roomWalls,
  interiorTexture,
  interiorTileM,
  type PlanPoint,
  type RoomModel,
  type RoomOpening,
  type SurfaceId,
} from "@/lib/room";
import { RoomProps } from "./RoomProps";

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
/**
 * A selected surface the camera is behind stays more visible than its
 * neighbours. At 16% the accent outline was the only sign anything had been
 * picked, which on a near wall reads as the click having missed.
 */
const OUTSIDE_OPACITY_SELECTED = 0.42;
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
 * The furniture in it is scenery and nothing else — see RoomProps. It is not
 * selectable, not priced and not counted; it is there because bare walls give
 * the eye nothing to measure 2,7 m against, and every room looks alike.
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
        product={finishOf(room, "floor")}
        fallback={DEFAULT_COLOUR.floor}
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
        product={finishOf(room, "ceiling")}
        fallback={DEFAULT_COLOUR.ceiling}
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
          product={finishOf(room, wall.id)}
          fallback={DEFAULT_COLOUR.wall}
          selected={selectedSurfaceId === wall.id}
          onSelect={onSelect}
        />
      ))}

      <RoomProps room={room} />

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
  /** The chosen finish, if there is one. */
  product: Product | undefined;
  /** What the surface looks like before anything is chosen. */
  fallback: string;
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
  product,
  fallback,
  selected,
  onSelect,
}: SurfaceProps) {
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const map = useSurfaceTexture(product);
  const outline = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

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
    const target =
      isOutside(camera.position, anchor, inward)
        ? selected
          ? OUTSIDE_OPACITY_SELECTED
          : OUTSIDE_OPACITY
        : INSIDE_OPACITY;
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
    <group position={position} rotation={rotation}>
      <mesh
        geometry={geometry}
        receiveShadow
        onClick={(e: ThreeEvent<MouseEvent>) => {
          // A faded surface does not take the click. From outside, the two
          // near walls stand between the camera and everything else, and
          // being all but invisible they were swallowing every click meant
          // for the floor or for a chair — the pointer would land on a wall
          // nobody could see. Not stopping propagation lets the click carry
          // on to whatever is actually behind it.
          if (isOutside(e.camera.position, anchor, inward)) return;
          e.stopPropagation();
          onSelect(id);
        }}
      >
        <meshStandardMaterial
          ref={material}
          map={map}
          // The material's own colour under the photograph, so an unchosen
          // surface still reads as floor or wall — and never as the accent.
          // Painting the selected surface gold hid the very finish the
          // reader had just picked, which is what made choosing a material
          // look like it had done nothing at all.
          color={map ? "#ffffff" : fallback}
          emissive={selected ? SELECTED : "#000000"}
          // Barely there. At any strength that reads as a highlight it also
          // tints the photograph, and a grey porcelain floor came out the
          // same cream as an oak one — the outline does the job on its own.
          emissiveIntensity={selected ? 0.05 : 0}
          roughness={0.86}
          metalness={0}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Selection is an edge, not a coat of paint. Drawn without depth
          testing so it still reads when the wall it belongs to has faded
          out behind another one. */}
      {selected && (
        <lineSegments geometry={outline} raycast={() => null} renderOrder={10}>
          <lineBasicMaterial color={SELECTED} depthTest={false} transparent />
        </lineSegments>
      )}
    </group>
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
  product: Product | undefined;
  fallback: string;
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
  product,
  fallback,
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
      product={product}
      fallback={fallback}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

/**
 * A door or window: the lining around the hole, and the glass in it.
 *
 * Without the lining a doorway reads as a missing wall — from inside you look
 * straight through it at the blueprint and the room seems unfinished. Real
 * walls have thickness, and the откос is the whole reason a doorway looks
 * like a doorway rather than a hole.
 */
const REVEAL_DEPTH_M = 0.14;
const REVEAL_THICKNESS_M = 0.03;

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

  const w = opening.widthM;
  const h = opening.heightM;
  const t = REVEAL_THICKNESS_M;
  const d = REVEAL_DEPTH_M;

  // Four slabs sitting just outside the hole's edges: a picture frame with
  // depth, which is what an откос is.
  const jambs: { args: [number, number, number]; at: [number, number, number] }[] = [
    { args: [w + t * 2, t, d], at: [0, h / 2 + t / 2, 0] },
    { args: [w + t * 2, t, d], at: [0, -h / 2 - t / 2, 0] },
    { args: [t, h, d], at: [-w / 2 - t / 2, 0, 0] },
    { args: [t, h, d], at: [w / 2 + t / 2, 0, 0] },
  ];

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {jambs.map((jamb, i) => (
        <mesh key={i} position={jamb.at} raycast={() => null} castShadow>
          <boxGeometry args={jamb.args} />
          {/* Opaque, and deliberately not part of the dollhouse fade: the
              lining is what still says "opening" when the wall around it has
              gone translucent. */}
          <meshStandardMaterial color="#d7d2c9" roughness={0.9} metalness={0} />
        </mesh>
      ))}

      {/* Glass in a window; a doorway stays an empty hole, which is what it
          still is once the finish goes on. */}
      {opening.kind === "window" && (
        <mesh geometry={pane} raycast={() => null}>
          <meshStandardMaterial
            color="#bcd6ff"
            transparent
            opacity={0.22}
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

/**
 * The tiling surface for a finish.
 *
 * Drawn, not photographed. The catalogue photograph has a vignette and a
 * defocused band baked into it — it is a product shot — so tiling it across a
 * wall repeated those gradients into a grid of squares. See
 * lib/room/interior-textures for how the drawn ones are made seamless.
 */
function useSurfaceTexture(product: Product | undefined): THREE.Texture | null {
  return useMemo(() => {
    if (!product) return null;
    const texture = interiorTexture(product.photo.kind, product.photo.tint);
    if (!texture) return null;
    // Every surface is a ShapeGeometry built in metres, and three writes its
    // UVs straight from those coordinates — so UV space IS metres, and the
    // repeat is simply one over the metres a tile spans. The density is the
    // real material's on a 2 m wall and on a 9 m one alike.
    const tile = interiorTileM(product.photo.kind);
    texture.repeat.set(1 / tile, 1 / tile);
    return texture;
  }, [product]);
}

/** Whether the camera is behind this surface, looking at its back. */
function isOutside(
  camera: THREE.Vector3,
  anchor: [number, number, number],
  inward: [number, number, number],
): boolean {
  return (
    (camera.x - anchor[0]) * inward[0] +
      (camera.y - anchor[1]) * inward[1] +
      (camera.z - anchor[2]) * inward[2] <
    0
  );
}

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

/** The finish chosen for a surface, if one has been. */
function finishOf(room: RoomModel, id: SurfaceId): Product | undefined {
  const productId = room.finishes[id];
  return productId ? productById(productId) : undefined;
}
