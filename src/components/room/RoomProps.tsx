"use client";

import * as THREE from "three";
import type { RoomModel } from "@/lib/room";

/**
 * Furniture, so the room reads as a room.
 *
 * Not a catalogue and not configurable: one of each piece, placed against the
 * walls the way a room is actually laid out, and inert to the pointer so a
 * click always lands on the surface behind it. Their only job is scale — an
 * empty box of walls gives the eye nothing to measure 2,7 m against, and
 * every room looks the same size. A bed does that job in one glance.
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

/** Nothing is placed closer than this to a wall — skirting, and elbows. */
const CLEARANCE_M = 0.06;

interface RoomPropsProps {
  room: RoomModel;
}

export function RoomProps({ room }: RoomPropsProps) {
  const { widthM: W, lengthM: L, heightM: H } = room.dimensions;

  // The L-shape cuts a corner out of the plan, and a wardrobe standing in the
  // missing corner would float outside the room. Rather than solve furniture
  // placement for an arbitrary polygon, pieces are laid out against the
  // bounding rectangle and the ones that fall in the notch are dropped.
  const notch =
    room.shape === "l" && room.notch
      ? {
          x0:
            room.notch.corner === "nw" || room.notch.corner === "sw"
              ? -W / 2
              : W / 2 - room.notch.widthM,
          z0:
            room.notch.corner === "nw" || room.notch.corner === "ne"
              ? -L / 2
              : L / 2 - room.notch.lengthM,
          w: room.notch.widthM,
          l: room.notch.lengthM,
        }
      : null;

  const half = { x: W / 2 - CLEARANCE_M, z: L / 2 - CLEARANCE_M };

  /** A piece is shown only if it fits the room and clears the notch. */
  const fits = (x: number, z: number, w: number, d: number) => {
    if (Math.abs(x) + w / 2 > half.x || Math.abs(z) + d / 2 > half.z) return false;
    if (!notch) return true;
    return !(
      x + w / 2 > notch.x0 &&
      x - w / 2 < notch.x0 + notch.w &&
      z + d / 2 > notch.z0 &&
      z - d / 2 < notch.z0 + notch.l
    );
  };

  // Bed against the west wall, head to the north — the way a bed goes into a
  // room, and the piece that sets the scale for everything else.
  const bed = { w: 1.6, d: 2.0, h: 0.52 };
  const bedX = -half.x + bed.w / 2;
  const bedZ = -half.z + bed.d / 2;

  const stand = { w: 0.44, d: 0.4, h: 0.5 };
  const standX = bedX + bed.w / 2 + stand.w / 2 + 0.04;
  const standZ = -half.z + stand.d / 2;

  const wardrobe = { w: 1.2, d: 0.6, h: Math.min(2.2, H - 0.25) };
  const wardrobeX = half.x - wardrobe.w / 2;
  const wardrobeZ = -half.z + wardrobe.d / 2;

  const desk = { w: 0.6, d: 1.4, h: 0.75 };
  const deskX = half.x - desk.w / 2;
  const deskZ = 0;

  const table = { w: 1.1, d: 0.72, h: 0.74 };
  const tableX = Math.min(0, half.x - table.w / 2 - 0.4);
  const tableZ = half.z - table.d / 2 - 0.55;

  const lampX = -half.x + 0.32;
  const lampZ = half.z - 0.32;

  return (
    // Props never take a click: the surface behind them is what the reader is
    // choosing a finish for, and a bed that swallows the pointer would make
    // half the floor unselectable.
    <group raycast={() => null}>
      {fits(bedX, bedZ, bed.w, bed.d) && (
        <Bed x={bedX} z={bedZ} {...bed} />
      )}
      {fits(standX, standZ, stand.w, stand.d) && (
        <Nightstand x={standX} z={standZ} {...stand} />
      )}
      {fits(wardrobeX, wardrobeZ, wardrobe.w, wardrobe.d) && (
        <Wardrobe x={wardrobeX} z={wardrobeZ} {...wardrobe} />
      )}
      {fits(deskX, deskZ, desk.w, desk.d) && (
        <Desk x={deskX} z={deskZ} {...desk} />
      )}
      {fits(tableX, tableZ, table.w, table.d + 1.1) && (
        <>
          <Table x={tableX} z={tableZ} {...table} />
          <Chair x={tableX} z={tableZ - table.d / 2 - 0.32} facing={0} />
          <Chair x={tableX} z={tableZ + table.d / 2 + 0.32} facing={Math.PI} />
          <Vase x={tableX} y={table.h} z={tableZ} />
        </>
      )}
      {fits(lampX, lampZ, 0.42, 0.42) && <FloorLamp x={lampX} z={lampZ} />}

      <Pendant height={H} />
    </group>
  );
}

// ------------------------------------------------------------------ пьесы

/** Wood, fabric, metal — three materials, so the room stays quiet. */
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

function Bed({ x, z, w, d, h }: { x: number; z: number; w: number; d: number; h: number }) {
  const base = h * 0.42;
  return (
    <group position={[x, 0, z]}>
      {/* Divan base, mattress, headboard, pillows, throw. */}
      <Box size={[w, base, d]} at={[0, base / 2, 0]} colour={OAK_DARK} />
      <Box size={[w - 0.06, h - base, d - 0.06]} at={[0, base + (h - base) / 2, 0]} colour={LINEN} roughness={0.95} />
      <Box size={[w, 0.9, 0.07]} at={[0, 0.45, -d / 2 + 0.035]} colour={OAK} />
      {[-1, 1].map((side) => (
        <Box
          key={side}
          size={[w / 2 - 0.1, 0.11, 0.36]}
          at={[side * (w / 4 + 0.02), h + 0.05, -d / 2 + 0.28]}
          colour="#ffffff"
          roughness={0.98}
        />
      ))}
      <Box size={[w - 0.04, 0.05, d * 0.38]} at={[0, h + 0.02, d * 0.24]} colour={FABRIC} roughness={0.95} />
    </group>
  );
}

function Nightstand({ x, z, w, d, h }: { x: number; z: number; w: number; d: number; h: number }) {
  return (
    <group position={[x, 0, z]}>
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
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Box
            key={`${sx}${sz}`}
            size={[0.03, 0.1, 0.03]}
            at={[sx * (w / 2 - 0.04), 0.05, sz * (d / 2 - 0.04)]}
            colour={OAK_DARK}
          />
        )),
      )}
    </group>
  );
}

function Wardrobe({ x, z, w, d, h }: { x: number; z: number; w: number; d: number; h: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box size={[w, h, d]} at={[0, h / 2, 0]} colour={CARCASS} roughness={0.7} />
      {/* The shadow gap between the two doors, and their handles. */}
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
      <Box size={[w, 0.06, d]} at={[0, 0.03, 0]} colour={OAK_DARK} />
    </group>
  );
}

function Desk({ x, z, w, d, h }: { x: number; z: number; w: number; d: number; h: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box size={[w, 0.04, d]} at={[0, h, 0]} colour={OAK} />
      {[-1, 1].map((sz) => (
        <Box
          key={sz}
          size={[w - 0.08, h - 0.04, 0.04]}
          at={[0, (h - 0.04) / 2, sz * (d / 2 - 0.06)]}
          colour={METAL}
          roughness={0.45}
          metalness={0.6}
        />
      ))}
      {/* A closed laptop, for scale rather than for detail. */}
      <Box size={[w * 0.6, 0.02, 0.32]} at={[0, h + 0.03, 0]} colour="#3a3d42" roughness={0.5} />
    </group>
  );
}

function Table({ x, z, w, d, h }: { x: number; z: number; w: number; d: number; h: number }) {
  return (
    <group position={[x, 0, z]}>
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

function Chair({ x, z, facing }: { x: number; z: number; facing: number }) {
  const seat = 0.45;
  return (
    <group position={[x, 0, z]} rotation={[0, facing, 0]}>
      <Box size={[0.44, 0.045, 0.42]} at={[0, seat, 0]} colour={OAK} />
      <Box size={[0.4, 0.42, 0.04]} at={[0, seat + 0.24, -0.19]} colour={OAK} />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[sx * 0.18, seat / 2, sz * 0.17]}
            castShadow
          >
            <cylinderGeometry args={[0.018, 0.014, seat, 8]} />
            <Surface colour={OAK_DARK} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Vase({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.14, 0]} castShadow>
        <latheGeometry
          args={[
            // Half a silhouette, revolved: a bellied vase with a narrow neck.
            [
              [0.001, 0],
              [0.05, 0],
              [0.07, 0.05],
              [0.075, 0.12],
              [0.055, 0.2],
              [0.042, 0.27],
              [0.05, 0.3],
            ].map(([r, h]) => new THREE.Vector2(r, h - 0.14)),
            18,
          ]}
        />
        <Surface colour={CERAMIC} roughness={0.28} />
      </mesh>
      {/* Three stems, so the vase reads as being for something. */}
      {[-0.5, 0.1, 0.7].map((tilt, i) => (
        <mesh
          key={i}
          position={[Math.sin(tilt) * 0.06, 0.44, Math.cos(tilt) * 0.03]}
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

function FloorLamp({ x, z }: { x: number; z: number }) {
  const stem = 1.45;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.19, 0.04, 20]} />
        <Surface colour={METAL} roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, stem / 2, 0]} castShadow>
        <cylinderGeometry args={[0.017, 0.017, stem, 10]} />
        <Surface colour={METAL} roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, stem + 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.19, 0.26, 20, 1, true]} />
        {/* Lit from inside, so the shade glows rather than sitting there as
            a grey cone in a room that is supposed to have light in it. */}
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

function Pendant({ height }: { height: number }) {
  const drop = Math.min(0.55, height * 0.22);
  const y = height - drop;
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, height - drop / 2, 0]}>
        <cylinderGeometry args={[0.006, 0.006, drop, 6]} />
        <Surface colour="#2f3237" roughness={0.6} />
      </mesh>
      <mesh position={[0, y - 0.09, 0]} castShadow>
        <coneGeometry args={[0.24, 0.2, 24, 1, true]} />
        <meshStandardMaterial
          color={SHADE}
          emissive="#ffe2b4"
          emissiveIntensity={0.65}
          roughness={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* One real light, low and warm: enough to shape the furniture without
          fighting the environment map the surfaces are lit by. */}
      <pointLight position={[0, y - 0.22, 0]} intensity={1.5} distance={7} decay={2} color="#ffdcae" />
    </group>
  );
}
