"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { roofDimensions, type RoofDims } from "@/lib/3d/roof-geometry";
import type { StyleDef } from "@/lib/3d/styles";
import type { Opening, SceneModel } from "@/lib/3d/types";
import { FLOOR_HEIGHT_M } from "@/lib/3d/types";

/**
 * The construction details that separate a massing study from a house:
 * eaves boards, a ridge cap, gutters and downpipes, a chimney, a plinth
 * band, an entrance porch, and the per-style trim. None of these change the
 * estimate — they are what the estimate is buying.
 */

const METAL = "#8E8B85";

interface DetailProps {
  model: SceneModel;
  style: StyleDef;
}

export function useRoofDims(model: SceneModel): RoofDims | null {
  const roof = model.nodes.find((n) => n.roof)?.roof;
  const { widthM, depthM } = model.dimensions;
  return useMemo(() => {
    if (!roof) return null;
    return roofDimensions(
      widthM,
      depthM,
      roof.overhangM,
      roof.pitchDeg,
      roof.shape,
    );
  }, [widthM, depthM, roof]);
}

/** A cylinder running between two points — gutters, downpipes and elbows. */
function Pipe({
  from,
  to,
  radius = 0.07,
  color = METAL,
}: {
  from: [number, number, number];
  to: [number, number, number];
  radius?: number;
  color?: string;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    return { position: mid, quaternion: q, length: Math.max(len, 0.001) };
  }, [from, to]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 10]} />
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.35} />
    </mesh>
  );
}

function Board({
  position,
  size,
  color,
  rotation,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

/** Eaves boards, rake boards and the ridge cap. */
export function RoofTrim({ model, style, dims }: DetailProps & { dims: RoofDims }) {
  const roof = model.nodes.find((n) => n.roof)?.roof;
  const { heightM } = model.dimensions;
  if (!roof) return null;

  const { halfWidth: hw, halfDepth: hd, rise } = dims;
  const eaves = heightM;
  const ridged = roof.shape === "gable" || roof.shape === "mansard";
  const color = style.trimColor;
  const board = 0.24;

  const pitch = Math.atan2(rise, hd);
  const rakeLength = Math.hypot(hd, rise);

  return (
    <group>
      {/* Fascia along the low edges, giving the roof visible thickness. */}
      {(ridged ? [hd, -hd] : [hd, -hd]).map((z, i) => (
        <Board
          key={`fz-${i}`}
          position={[0, eaves - board / 2, z]}
          size={[hw * 2 + 0.08, board, 0.07]}
          color={color}
        />
      ))}
      {!ridged &&
        [hw, -hw].map((x, i) => (
          <Board
            key={`fx-${i}`}
            position={[x, eaves - board / 2, 0]}
            size={[0.07, board, hd * 2]}
            color={color}
          />
        ))}

      {/* Rake boards follow the slope up the gable ends. */}
      {ridged &&
        [hw, -hw].flatMap((x) =>
          [1, -1].map((dir) => (
            <Board
              key={`rake-${x}-${dir}`}
              position={[
                x,
                eaves + rise / 2 - board / 2,
                (dir * hd) / 2,
              ]}
              rotation={[dir * pitch, 0, 0]}
              size={[0.07, board, rakeLength]}
              color={color}
            />
          )),
        )}

      {/* Ridge cap. Hip ridges are shorter than the building. */}
      {roof.shape !== "flat" && (
        <Board
          position={[0, eaves + rise + 0.04, 0]}
          size={[
            roof.shape === "hip" ? Math.abs(hw - hd) * 2 + 0.4 : hw * 2 + 0.08,
            0.12,
            0.3,
          ]}
          color={color}
        />
      )}
    </group>
  );
}

/** Half-round gutters at the eaves, with downpipes angled back to the wall. */
export function Drainage({ model, dims }: DetailProps & { dims: RoofDims }) {
  const roof = model.nodes.find((n) => n.roof)?.roof;
  const { widthM, depthM, heightM } = model.dimensions;
  if (!roof) return null;

  const { halfWidth: hw, halfDepth: hd } = dims;
  const y = heightM - 0.3;
  const ridgedRoof = roof.shape === "gable" || roof.shape === "mansard";

  const wallX = widthM / 2 + 0.1;
  const wallZ = depthM / 2 + 0.1;

  return (
    <group>
      {/* Gutters run along whichever edges the roof actually drains to. */}
      {[hd, -hd].map((z, i) => (
        <Pipe
          key={`g-${i}`}
          from={[-hw, y, z]}
          to={[hw, y, z]}
          radius={0.075}
        />
      ))}
      {!ridgedRoof &&
        [hw, -hw].map((x, i) => (
          <Pipe
            key={`gx-${i}`}
            from={[x, y, -hd]}
            to={[x, y, hd]}
            radius={0.075}
          />
        ))}

      {/* Downpipes: an elbow back to the wall, then a straight run down. */}
      {[1, -1].flatMap((sx) =>
        [1, -1].map((sz) => (
          <group key={`dp-${sx}-${sz}`}>
            <Pipe
              from={[sx * (hw - 0.12), y, sz * hd]}
              to={[sx * wallX, y - 0.7, sz * wallZ]}
              radius={0.055}
            />
            <Pipe
              from={[sx * wallX, y - 0.7, sz * wallZ]}
              to={[sx * wallX, 0.7, sz * wallZ]}
              radius={0.055}
            />
          </group>
        )),
      )}
    </group>
  );
}

export function Chimney({ model, style, dims }: DetailProps & { dims: RoofDims }) {
  const roof = model.nodes.find((n) => n.roof)?.roof;
  const { widthM, heightM } = model.dimensions;
  const kind = style.details.chimney;
  if (!roof || kind === "none") return null;

  const top = heightM + dims.rise + (kind === "flue" ? 1.3 : 0.9);
  const base = heightM - 0.6;
  const h = top - base;
  const x = widthM * 0.26;

  // A barnhouse vents through a slim insulated flue, not a masonry stack.
  if (kind === "flue") {
    return (
      <group position={[x, 0, 0]}>
        <mesh position={[0, base + h / 2, 0]}>
          <cylinderGeometry args={[0.11, 0.11, h, 14]} />
          <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0, top + 0.1, 0]}>
          <cylinderGeometry args={[0.17, 0.13, 0.16, 14]} />
          <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.5} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, base + h / 2, 0]}>
        <boxGeometry args={[0.75, h, 0.75]} />
        <meshStandardMaterial color={style.plinthColor} roughness={0.9} />
      </mesh>
      <mesh position={[0, top + 0.06, 0]}>
        <boxGeometry args={[0.95, 0.12, 0.95]} />
        <meshStandardMaterial color={style.trimColor} roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Cornice bands marking each floor line, plus one at the wall head. */
export function StringCourses({ model, style }: DetailProps) {
  const { widthM, depthM, heightM } = model.dimensions;
  if (!style.details.stringCourse) return null;

  const levels: number[] = [];
  for (let f = 1; f < model.floors; f++) levels.push(f * FLOOR_HEIGHT_M);

  return (
    <group>
      {levels.map((y) => (
        <Board
          key={y}
          position={[0, y, 0]}
          size={[widthM + 0.24, 0.18, depthM + 0.24]}
          color={style.trimColor}
        />
      ))}
      <Board
        position={[0, heightM - 0.12, 0]}
        size={[widthM + 0.26, 0.24, depthM + 0.26]}
        color={style.trimColor}
      />
    </group>
  );
}

/**
 * Rusticated corner stones. Each course is a pair of shallow plates, one laid
 * on each face, so the corner is wrapped the way real quoining is — a single
 * block centred on the corner reads as a tab bolted to the outside.
 */
export function Quoins({ model, style }: DetailProps) {
  const { widthM, depthM, heightM } = model.dimensions;
  if (!style.details.quoins) return null;

  const courses = Math.floor((heightM - 0.9) / 0.7);
  const relief = 0.06;
  const thick = 0.34;
  const corners: [number, number][] = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];

  return (
    <group>
      {corners.flatMap(([sx, sz]) =>
        Array.from({ length: courses }, (_, i) => {
          const y = 0.85 + i * 0.7;
          // Courses alternate long-on-front / long-on-side, as bonded stone does.
          const longOnX = i % 2 === 0;
          const a = longOnX ? 0.8 : 0.45;
          const b = longOnX ? 0.45 : 0.8;
          return (
            <group key={`${sx}-${sz}-${i}`}>
              {/* Plate on the side face */}
              <mesh
                position={[
                  sx * (widthM / 2 + relief / 2),
                  y,
                  sz * (depthM / 2 - b / 2),
                ]}
              >
                <boxGeometry args={[relief, thick, b]} />
                <meshStandardMaterial color={style.trimColor} roughness={0.8} />
              </mesh>
              {/* Plate on the front/back face */}
              <mesh
                position={[
                  sx * (widthM / 2 - a / 2),
                  y,
                  sz * (depthM / 2 + relief / 2),
                ]}
              >
                <boxGeometry args={[a, thick, relief]} />
                <meshStandardMaterial color={style.trimColor} roughness={0.8} />
              </mesh>
            </group>
          );
        }),
      )}
    </group>
  );
}

/** Shutters flanking the front windows. */
export function Shutters({
  model,
  style,
  openings,
}: DetailProps & { openings: Opening[] }) {
  const { depthM } = model.dimensions;
  if (!style.details.shutters) return null;

  const front = openings.filter(
    (o) => o.kind === "window" && o.facade === "front",
  );

  return (
    <group>
      {front.flatMap((o) =>
        [1, -1].map((side) => (
          <mesh
            key={`${o.id}-${side}`}
            position={[
              o.offsetM + side * (o.widthM / 2 + o.widthM * 0.26),
              o.sillM + o.heightM / 2,
              depthM / 2 + 0.05,
            ]}
          >
            <boxGeometry args={[o.widthM * 0.5, o.heightM, 0.05]} />
            <meshStandardMaterial color={style.colors.door ?? "#4A3626"} roughness={0.7} />
          </mesh>
        )),
      )}
    </group>
  );
}

/**
 * A timber terrace running the length of the entrance elevation — the deck a
 * barnhouse or a flat-roofed house is built around, rather than a compact
 * set of front steps.
 */
export function Deck({ model, style }: DetailProps) {
  const { widthM, depthM } = model.dimensions;
  if (!style.details.deck) return null;

  const z0 = depthM / 2;
  const boards = 14;
  const deckDepth = 2.4;

  return (
    <group>
      {/* Board-by-board, so the decking reads as laid timber. */}
      {Array.from({ length: boards }, (_, i) => {
        const step = deckDepth / boards;
        return (
          <mesh
            key={i}
            position={[0, 0.5, z0 + 0.1 + step / 2 + i * step]}
          >
            <boxGeometry args={[widthM * 0.92, 0.1, step * 0.86]} />
            <meshStandardMaterial color="#8A5C33" roughness={0.85} />
          </mesh>
        );
      })}
      {/* Edge beam and a low step down to the ground. */}
      <mesh position={[0, 0.35, z0 + deckDepth + 0.12]}>
        <boxGeometry args={[widthM * 0.92, 0.42, 0.12]} />
        <meshStandardMaterial color="#6F4A29" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.16, z0 + deckDepth + 0.38]}>
        <boxGeometry args={[widthM * 0.55, 0.16, 0.42]} />
        <meshStandardMaterial color={style.plinthColor} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Entrance platform, steps and a canopy on posts. */
export function Porch({ model, style, openings }: DetailProps & { openings: Opening[] }) {
  const { depthM } = model.dimensions;
  const door = openings.find((o) => o.kind === "door");
  // A house with a full-width deck does not also get a doorstep porch.
  if (!door || style.details.deck) return null;

  const z0 = depthM / 2;
  const stone = style.plinthColor;

  return (
    <group position={[door.offsetM, 0, 0]}>
      {/* Platform level with the threshold, then two steps down. */}
      <mesh position={[0, 0.45, z0 + 0.75]}>
        <boxGeometry args={[2.3, 0.2, 1.5]} />
        <meshStandardMaterial color={stone} roughness={0.9} />
      </mesh>
      {[0, 1].map((i) => (
        <mesh key={i} position={[0, 0.28 - i * 0.18, z0 + 1.62 + i * 0.34]}>
          <boxGeometry args={[2.3, 0.18, 0.34]} />
          <meshStandardMaterial color={stone} roughness={0.9} />
        </mesh>
      ))}

      {style.details.porchCanopy && (
        <>
          <mesh position={[0, 2.85, z0 + 0.8]}>
            <boxGeometry args={[2.6, 0.14, 1.7]} />
            <meshStandardMaterial color={style.trimColor} roughness={0.7} />
          </mesh>
          {[1, -1].map((side) => (
            <mesh
              key={side}
              position={[side * 1.1, 1.45, z0 + 1.45]}
            >
              <boxGeometry args={[0.12, 2.7, 0.12]} />
              <meshStandardMaterial color={style.trimColor} roughness={0.7} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}
