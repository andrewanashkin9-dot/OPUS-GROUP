"use client";

import type * as THREE from "three";
import { getDeskTextures } from "@/lib/3d/desk-textures";

/**
 * The drafting table the model is built on.
 *
 * The hero lands the camera on a lit table with a blueprint; the editor then
 * builds the house on that same table rather than in an empty void, so the
 * two screens read as one place. Everything here is scenery: nothing is
 * clickable, nothing is selectable, and it never intercepts a pointer that
 * was aimed at the building.
 *
 * Sizes are in the same metres the house uses. The tools are drawn at a size
 * that reads next to a scale model rather than at true 30cm, the way a
 * physical model and its instruments share a table.
 */

/** Keeps the desk clear of the fence ring, which reaches ±8.6 × ±7.4. */
const SHEET_W = 42;
const SHEET_D = 30;
const DESK_W = 60;
const DESK_D = 44;

const SHEET_Y = -0.02;
const DESK_Y = -0.35;

export function DeskScene() {
  // Shared, built once for the page — see getDeskTextures.
  const { blueprint, ruler: rulerFace, desk } = getDeskTextures();

  return (
    // Scenery must never swallow a click meant for the house.
    <group raycast={() => null}>
      {/* Table top */}
      <mesh position={[0, DESK_Y, 0]} raycast={() => null}>
        <boxGeometry args={[DESK_W, 0.6, DESK_D]} />
        <meshStandardMaterial map={desk} roughness={0.92} />
      </mesh>

      {/* The drawing, very slightly proud of the table */}
      <mesh
        position={[0, SHEET_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <planeGeometry args={[SHEET_W, SHEET_D]} />
        <meshStandardMaterial map={blueprint} roughness={0.85} />
      </mesh>

      <Ruler face={rulerFace} />
      <Pencil />
      <Phone />
    </group>
  );
}

/** Yellow scale rule, laid along the right of the sheet. */
function Ruler({ face }: { face: THREE.Texture }) {
  return (
    // Built lying along X and then turned, because a box maps its texture's
    // u axis along X: laid out along Z instead, all sixty graduations would be
    // squeezed across the rule's 1.5-unit width and read as a plain yellow bar.
    <group
      position={[10.4, 0.09, 1.4]}
      rotation={[0, Math.PI / 2 - 0.12, 0]}
      raycast={() => null}
    >
      <mesh raycast={() => null}>
        <boxGeometry args={[16, 0.16, 1.5]} />
        {/* The graduated face is the one pointing up; the sides take the
            same yellow, which is what a solid plastic rule does anyway. */}
        <meshStandardMaterial
          map={face}
          roughness={0.45}
          metalness={0.05}
          color="#ffffff"
        />
      </mesh>
      {/* Bevelled edge catching the lamp */}
      <mesh position={[0, 0.02, -0.78]} raycast={() => null}>
        <boxGeometry args={[16, 0.13, 0.08]} />
        <meshStandardMaterial color="#F7D877" roughness={0.35} />
      </mesh>
    </group>
  );
}

/** Hexagonal pencil, resting across the sheet's lower edge. */
function Pencil() {
  const BODY = 7.6;
  return (
    <group position={[-9.6, 0.24, 8.6]} rotation={[0, 0.42, Math.PI / 2]} raycast={() => null}>
      {/* Painted barrel — six sides, like a real drawing pencil */}
      <mesh raycast={() => null}>
        <cylinderGeometry args={[0.24, 0.24, BODY, 6]} />
        <meshStandardMaterial color="#D8A32B" roughness={0.5} />
      </mesh>
      {/* Sharpened cone and graphite */}
      <mesh position={[0, -BODY / 2 - 0.32, 0]} raycast={() => null}>
        <coneGeometry args={[0.24, 0.64, 6]} />
        <meshStandardMaterial color="#E8D8B8" roughness={0.7} />
      </mesh>
      <mesh position={[0, -BODY / 2 - 0.68, 0]} raycast={() => null}>
        <coneGeometry args={[0.075, 0.2, 6]} />
        <meshStandardMaterial color="#1C1A17" roughness={0.55} />
      </mesh>
      {/* Ferrule and eraser */}
      <mesh position={[0, BODY / 2 + 0.16, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.25, 0.25, 0.32, 12]} />
        <meshStandardMaterial color="#9AA0A6" roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh position={[0, BODY / 2 + 0.44, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.23, 0.23, 0.26, 12]} />
        <meshStandardMaterial color="#C97F72" roughness={0.85} />
      </mesh>
    </group>
  );
}

/**
 * The phone the estimate and the order continue on. It sits face-up on the
 * table here; the stage transitions are what actually travel to it.
 */
function Phone() {
  return (
    <group position={[-10.8, 0.06, -7.6]} rotation={[0, 0.34, 0]} raycast={() => null}>
      <mesh raycast={() => null}>
        <boxGeometry args={[6.2, 0.22, 12.4]} />
        <meshStandardMaterial color="#17181A" roughness={0.35} metalness={0.55} />
      </mesh>
      {/* Screen, dark and glossy — lit content belongs to the transition */}
      <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[5.5, 11.6]} />
        <meshStandardMaterial color="#0A0C10" roughness={0.12} metalness={0.2} />
      </mesh>
      {/* A sliver of the interface showing through the glass */}
      <mesh position={[0, 0.14, -3.4]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[4.4, 0.5]} />
        <meshStandardMaterial
          color="#E4D2AC"
          emissive="#E4D2AC"
          emissiveIntensity={0.35}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}
