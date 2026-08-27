"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  furnitureVariant,
  type FurnitureItem,
  type FurnitureVariant,
  type RoomModel,
} from "@/lib/room";
import { useAppStore } from "@/lib/store";

/**
 * The furniture in the room: placed, moved, swapped and thrown out.
 *
 * None of it is priced or counted — it changes no square metre of the
 * estimate. It is here because bare walls give the eye nothing to measure
 * 2,7 m against, and because a layout you cannot move is a layout that is
 * wrong for your room and stays wrong.
 *
 * Everything is built from primitives rather than loaded as a mesh: these are
 * props, not products, and a downloaded model would be a megabyte of detail
 * nobody is going to look at.
 */

const OAK = "#a98457";
const OAK_DARK = "#7d5f3c";
const LINEN = "#d9d3c6";
/** The wardrobe, kept off white so it does not melt into a pale wall. */
const CARCASS = "#bdb5a8";
const FABRIC = "#8d93a0";
const METAL = "#9aa0a8";
const SHADE = "#f3ead6";
const CERAMIC = "#c8ccd2";
/** The accent, lifted: on a lit surface pure gold reads dull. */
const SELECTED = "#ffe14d";

export function RoomProps({ room }: { room: RoomModel }) {
  const selectedId = useAppStore((s) => s.selectedFurnitureId);
  const draggingId = useAppStore((s) => s.draggingFurnitureId);

  return (
    <group>
      {room.furniture.map((item) => (
        <Piece
          key={item.id}
          room={room}
          item={item}
          selected={item.id === selectedId}
          dragging={item.id === draggingId}
        />
      ))}
    </group>
  );
}

// ------------------------------------------------------------- перетаскивание

/** The plan, as a plane to drag against. */
const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function Piece({
  room,
  item,
  selected,
  dragging,
}: {
  room: RoomModel;
  item: FurnitureItem;
  selected: boolean;
  dragging: boolean;
}) {
  const variant = furnitureVariant(item.kind, item.variant);
  const selectFurniture = useAppStore((s) => s.selectFurniture);
  const beginFurnitureDrag = useAppStore((s) => s.beginFurnitureDrag);
  const endFurnitureDrag = useAppStore((s) => s.endFurnitureDrag);
  const moveFurniture = useAppStore((s) => s.moveFurniture);

  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  // Where on the piece it was picked up, so a wardrobe grabbed by its corner
  // keeps that corner under the pointer instead of jumping its centre there.
  const grab = useRef({ x: 0, z: 0 });

  // Dragging listens on the window rather than on the mesh. A pointer that
  // has outrun the object it grabbed would otherwise drop it, which is
  // exactly what happens when you move something quickly.
  useEffect(() => {
    if (!dragging) return;
    const canvas = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hit = new THREE.Vector3();

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(FLOOR_PLANE, hit)) return;
      moveFurniture(item.id, hit.x + grab.current.x, hit.z + grab.current.z);
      invalidate();
    };
    const onUp = () => endFurnitureDrag();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, camera, gl, invalidate, item.id, moveFurniture, endFurnitureDrag]);

  const ceiling = item.kind === "pendant";
  const y = ceiling ? room.dimensions.heightM : 0;

  return (
    <group
      position={[item.x, y, item.z]}
      rotation={[0, item.rotationY, 0]}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const at = new THREE.Vector3();
        grab.current = e.ray.intersectPlane(FLOOR_PLANE, at)
          ? { x: item.x - at.x, z: item.z - at.z }
          : { x: 0, z: 0 };
        beginFurnitureDrag(item.id);
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        // Stops the click reaching the surface underneath: the reader is
        // picking up a chair, not choosing a floor.
        e.stopPropagation();
        selectFurniture(item.id);
      }}
    >
      <Model kind={item.kind} variant={variant} />
      {selected && <SelectionRing variant={variant} raised={ceiling} />}
    </group>
  );
}

/** A ring on the floor under the selected piece, and its footprint. */
function SelectionRing({
  variant,
  raised,
}: {
  variant: FurnitureVariant;
  raised: boolean;
}) {
  const geometry = useMemo(() => {
    const w = variant.widthM / 2 + 0.05;
    const d = variant.depthM / 2 + 0.05;
    const corners: [number, number][] = [
      [-w, -d],
      [w, -d],
      [w, d],
      [-w, d],
    ];
    // lineSegments rather than line: `<line>` collides with the SVG intrinsic
    // of the same name, so the loop is spelled out as four pairs.
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      points.push(new THREE.Vector3(ax, 0, az), new THREE.Vector3(bx, 0, bz));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [variant]);

  return (
    <lineSegments
      // A pendant's footprint belongs on the ceiling it hangs from, not on
      // the floor two and a half metres below it.
      position={[0, raised ? 0.01 : 0.012, 0]}
      geometry={geometry}
      raycast={() => null}
      renderOrder={12}
    >
      <lineBasicMaterial color={SELECTED} depthTest={false} transparent />
    </lineSegments>
  );
}

// ------------------------------------------------------------------- модели

function Model({
  kind,
  variant,
}: {
  kind: FurnitureItem["kind"];
  variant: FurnitureVariant;
}) {
  switch (kind) {
    case "bed":
      return <Bed v={variant} />;
    case "wardrobe":
      return <Wardrobe v={variant} sliding={variant.id === "sliding"} />;
    case "nightstand":
      return <Nightstand v={variant} open={variant.id === "open"} />;
    case "desk":
      return <Desk v={variant} counter={variant.id === "counter"} />;
    case "table":
      return variant.id === "round" ? <RoundTable v={variant} /> : <Table v={variant} />;
    case "chair":
      return <Chair soft={variant.id === "soft"} />;
    case "vase":
      return <Vase low={variant.id === "low"} />;
    case "floor-lamp":
      return <FloorLamp v={variant} tripod={variant.id === "tripod"} />;
    case "pendant":
      return <Pendant globe={variant.id === "globe"} />;
  }
}

function Surface({
  colour,
  roughness = 0.75,
  metalness = 0,
}: {
  colour: string;
  roughness?: number;
  metalness?: number;
}) {
  return (
    <meshStandardMaterial color={colour} roughness={roughness} metalness={metalness} />
  );
}

function Box({
  size,
  at,
  colour,
  roughness,
  metalness,
}: {
  size: [number, number, number];
  at: [number, number, number];
  colour: string;
  roughness?: number;
  metalness?: number;
}) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <Surface colour={colour} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

function Bed({ v }: { v: FurnitureVariant }) {
  const w = v.widthM;
  const d = v.depthM;
  const h = v.heightM;
  const base = h * 0.42;
  const pillows = w > 1.2 ? 2 : 1;
  return (
    <group>
      <Box size={[w, base, d]} at={[0, base / 2, 0]} colour={OAK_DARK} />
      <Box
        size={[w - 0.06, h - base, d - 0.06]}
        at={[0, base + (h - base) / 2, 0]}
        colour={LINEN}
        roughness={0.95}
      />
      <Box size={[w, 0.9, 0.07]} at={[0, 0.45, -d / 2 + 0.035]} colour={OAK} />
      {Array.from({ length: pillows }, (_, i) => (
        <Box
          key={i}
          size={[w / pillows - 0.12, 0.11, 0.36]}
          at={[
            pillows === 1 ? 0 : (i - 0.5) * (w / 2 + 0.04),
            h + 0.05,
            -d / 2 + 0.28,
          ]}
          colour="#ffffff"
          roughness={0.98}
        />
      ))}
      <Box
        size={[w - 0.04, 0.05, d * 0.38]}
        at={[0, h + 0.02, d * 0.24]}
        colour={FABRIC}
        roughness={0.95}
      />
    </group>
  );
}

function Wardrobe({ v, sliding }: { v: FurnitureVariant; sliding: boolean }) {
  const { widthM: w, depthM: d, heightM: h } = v;
  return (
    <group>
      <Box size={[w, h, d]} at={[0, h / 2, 0]} colour={CARCASS} roughness={0.7} />
      {/* Sliding doors overlap and run on a track; hinged doors meet in the
          middle and have handles either side of the gap. */}
      {sliding ? (
        <>
          <Box size={[w * 0.5, h - 0.1, 0.012]} at={[-w * 0.24, h / 2, d / 2 + 0.008]} colour={shadeHex(CARCASS, -0.05)} />
          <Box size={[0.02, h * 0.4, 0.02]} at={[w * 0.02, h * 0.5, d / 2 + 0.02]} colour={METAL} roughness={0.35} metalness={0.8} />
          <Box size={[w, 0.02, 0.03]} at={[0, h - 0.02, d / 2 + 0.01]} colour={METAL} roughness={0.4} metalness={0.7} />
        </>
      ) : (
        <>
          <Box size={[0.012, h - 0.12, 0.01]} at={[0, h / 2, d / 2 + 0.005]} colour={OAK_DARK} />
          {[-1, 1].map((side) => (
            <Box
              key={side}
              size={[0.02, 0.22, 0.02]}
              at={[side * 0.05, h * 0.52, d / 2 + 0.02]}
              colour={METAL}
              roughness={0.35}
              metalness={0.8}
            />
          ))}
        </>
      )}
      <Box size={[w, 0.06, d]} at={[0, 0.03, 0]} colour={OAK_DARK} />
    </group>
  );
}

function Nightstand({ v, open }: { v: FurnitureVariant; open: boolean }) {
  const { widthM: w, depthM: d, heightM: h } = v;
  return (
    <group>
      {open ? (
        <>
          {/* Two shelves and four legs, rather than a closed carcass. */}
          <Box size={[w, 0.03, d]} at={[0, h, 0]} colour={OAK} />
          <Box size={[w - 0.06, 0.03, d - 0.06]} at={[0, h * 0.45, 0]} colour={OAK} />
        </>
      ) : (
        <>
          <Box size={[w, h - 0.1, d]} at={[0, (h - 0.1) / 2 + 0.1, 0]} colour={OAK} />
          {[0, 1].map((i) => (
            <Box
              key={i}
              size={[w * 0.6, 0.015, 0.02]}
              at={[0, 0.24 + i * 0.2, d / 2 + 0.01]}
              colour={METAL}
              roughness={0.4}
              metalness={0.7}
            />
          ))}
        </>
      )}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Box
            key={`${sx}${sz}`}
            size={[0.03, open ? h : 0.1, 0.03]}
            at={[
              sx * (w / 2 - 0.04),
              open ? h / 2 : 0.05,
              sz * (d / 2 - 0.04),
            ]}
            colour={OAK_DARK}
          />
        )),
      )}
    </group>
  );
}

function Desk({ v, counter }: { v: FurnitureVariant; counter: boolean }) {
  const { widthM: w, depthM: d, heightM: h } = v;
  return (
    <group>
      <Box size={[w, 0.04, d]} at={[0, h, 0]} colour={counter ? "#8f8b84" : OAK} />
      {counter ? (
        // A worktop sits on cabinets, not on legs.
        <Box size={[w - 0.06, h - 0.14, d - 0.08]} at={[0, (h - 0.14) / 2 + 0.1, 0]} colour={CARCASS} />
      ) : (
        [-1, 1].map((sz) => (
          <Box
            key={sz}
            size={[w - 0.08, h - 0.04, 0.04]}
            at={[0, (h - 0.04) / 2, sz * (d / 2 - 0.06)]}
            colour={METAL}
            roughness={0.45}
            metalness={0.6}
          />
        ))
      )}
      <Box size={[w * 0.6, 0.02, 0.32]} at={[0, h + 0.03, 0]} colour="#3a3d42" roughness={0.5} />
    </group>
  );
}

function Table({ v }: { v: FurnitureVariant }) {
  const { widthM: w, depthM: d, heightM: h } = v;
  return (
    <group>
      <Box size={[w, 0.045, d]} at={[0, h, 0]} colour={OAK} />
      <Box size={[w - 0.16, 0.06, d - 0.16]} at={[0, h - 0.06, 0]} colour={OAK_DARK} />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[sx * (w / 2 - 0.1), (h - 0.05) / 2, sz * (d / 2 - 0.1)]}
            castShadow
          >
            <cylinderGeometry args={[0.028, 0.022, h - 0.05, 10]} />
            <Surface colour={OAK_DARK} />
          </mesh>
        )),
      )}
    </group>
  );
}

function RoundTable({ v }: { v: FurnitureVariant }) {
  const r = v.widthM / 2;
  const h = v.heightM;
  return (
    <group>
      <mesh position={[0, h, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, 0.045, 32]} />
        <Surface colour={OAK} />
      </mesh>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.075, h, 14]} />
        <Surface colour={OAK_DARK} />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[r * 0.5, r * 0.55, 0.04, 20]} />
        <Surface colour={OAK_DARK} />
      </mesh>
    </group>
  );
}

function Chair({ soft }: { soft: boolean }) {
  const seat = 0.45;
  return (
    <group>
      <Box
        size={[0.44, soft ? 0.11 : 0.045, 0.42]}
        at={[0, seat, 0]}
        colour={soft ? FABRIC : OAK}
        roughness={soft ? 0.95 : 0.75}
      />
      <Box
        size={[0.4, 0.42, soft ? 0.1 : 0.04]}
        at={[0, seat + 0.24, -0.19]}
        colour={soft ? FABRIC : OAK}
        roughness={soft ? 0.95 : 0.75}
      />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.18, seat / 2, sz * 0.17]} castShadow>
            <cylinderGeometry args={[0.018, 0.014, seat, 8]} />
            <Surface colour={OAK_DARK} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Vase({ low }: { low: boolean }) {
  const profile = low
    ? [
        [0.001, 0],
        [0.07, 0],
        [0.11, 0.05],
        [0.1, 0.13],
        [0.08, 0.18],
      ]
    : [
        [0.001, 0],
        [0.05, 0],
        [0.07, 0.05],
        [0.075, 0.12],
        [0.055, 0.2],
        [0.042, 0.27],
        [0.05, 0.3],
      ];
  const top = profile[profile.length - 1][1];

  return (
    <group>
      <mesh castShadow>
        <latheGeometry
          args={[profile.map(([r, h]) => new THREE.Vector2(r, h)), 18]}
        />
        <Surface colour={CERAMIC} roughness={0.28} />
      </mesh>
      {[-0.5, 0.1, 0.7].map((tilt, i) => (
        <mesh
          key={i}
          position={[Math.sin(tilt) * 0.05, top + 0.15, Math.cos(tilt) * 0.03]}
          rotation={[0.1, 0, tilt * 0.25]}
          castShadow
        >
          <cylinderGeometry args={[0.006, 0.006, 0.3, 5]} />
          <Surface colour="#5d7a52" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function FloorLamp({ v, tripod }: { v: FurnitureVariant; tripod: boolean }) {
  const stem = v.heightM - 0.3;
  return (
    <group>
      {tripod ? (
        [0, 1, 2].map((i) => {
          const angle = (i / 3) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 0.16, stem * 0.35, Math.sin(angle) * 0.16]}
              rotation={[Math.sin(angle) * 0.36, 0, -Math.cos(angle) * 0.36]}
              castShadow
            >
              <cylinderGeometry args={[0.014, 0.011, stem * 0.78, 8]} />
              <Surface colour={OAK_DARK} roughness={0.6} />
            </mesh>
          );
        })
      ) : (
        <mesh position={[0, 0.02, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.19, 0.04, 20]} />
          <Surface colour={METAL} roughness={0.4} metalness={0.6} />
        </mesh>
      )}
      <mesh position={[0, stem / 2, 0]} castShadow>
        <cylinderGeometry args={[0.017, 0.017, stem, 10]} />
        <Surface colour={METAL} roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, stem + 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.19, 0.26, 20, 1, true]} />
        {/* Lit from inside, so the shade glows rather than sitting there as a
            grey cone in a room that is supposed to have light in it. */}
        <meshStandardMaterial
          color={SHADE}
          emissive="#ffd9a0"
          emissiveIntensity={0.5}
          roughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function Pendant({ globe }: { globe: boolean }) {
  const drop = 0.55;
  return (
    <group>
      <mesh position={[0, -drop / 2, 0]}>
        <cylinderGeometry args={[0.006, 0.006, drop, 6]} />
        <Surface colour="#2f3237" roughness={0.6} />
      </mesh>
      <mesh position={[0, -drop - (globe ? 0.17 : 0.09), 0]} castShadow>
        {globe ? (
          <sphereGeometry args={[0.17, 20, 14]} />
        ) : (
          <coneGeometry args={[0.24, 0.2, 24, 1, true]} />
        )}
        <meshStandardMaterial
          color={SHADE}
          emissive="#ffe2b4"
          emissiveIntensity={globe ? 0.8 : 0.65}
          roughness={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* One real light, low and warm: enough to shape the furniture without
          fighting the environment map the surfaces are lit by. */}
      <pointLight
        position={[0, -drop - 0.28, 0]}
        intensity={1.5}
        distance={7}
        decay={2}
        color="#ffdcae"
      />
    </group>
  );
}

/** A quick tint shift, for the one place a second shade of the carcass helps. */
function shadeHex(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0, 1));
  return `#${c.getHexString()}`;
}
