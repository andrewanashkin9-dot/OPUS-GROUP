import * as THREE from "three";
import type { RoofShape } from "./types";

/**
 * Roof shells, built to sit on top of the walls and project past them.
 *
 * The roof footprint is always the wall footprint plus `overhangM` on every
 * side — the eaves have to throw water clear of the facade. A roof narrower
 * than its walls is the single most obvious way a house model reads as fake.
 *
 * All geometries are returned with their eaves plane at y = 0, so the caller
 * positions them at wall height and nothing has to know about the offset.
 */

const FLAT_SLAB_M = 0.3;

export interface RoofDims {
  /** Half-width of the roof, including the overhang. */
  halfWidth: number;
  /** Half-depth of the roof, including the overhang. */
  halfDepth: number;
  /** Height from the eaves to the ridge. */
  rise: number;
}

export function roofDimensions(
  widthM: number,
  depthM: number,
  overhangM: number,
  pitchDeg: number,
  shape: RoofShape,
): RoofDims {
  const halfWidth = widthM / 2 + overhangM;
  const halfDepth = depthM / 2 + overhangM;
  const rise =
    shape === "flat"
      ? FLAT_SLAB_M
      : halfDepth * Math.tan(THREE.MathUtils.degToRad(pitchDeg));
  return { halfWidth, halfDepth, rise };
}

/**
 * Roof surfaces are textured by projecting straight down, then letting the
 * texture repeat account for the slope length. Good enough for tile and seam
 * patterns, and far simpler than unwrapping each pitch separately.
 */
function applyPlanarUV(geometry: THREE.BufferGeometry, hw: number, hd: number) {
  const pos = geometry.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + hw) / (2 * hw);
    uv[i * 2 + 1] = (pos.getZ(i) + hd) / (2 * hd);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

/**
 * Sweeps a roof profile across the width as an open shell — surfaces only, no
 * end caps. A solid prism would occupy the very space the gable wall needs,
 * and the two would z-fight along every sloping face.
 */
function shellFromProfile(
  profile: THREE.Vector2[],
  hw: number,
  hd: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const push = (x: number, p: THREE.Vector2) => positions.push(x, p.y, p.x);

  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i];
    const b = profile[i + 1];
    // Two triangles per span, wound so the outward face points up and out.
    push(-hw, a);
    push(hw, a);
    push(hw, b);
    push(-hw, a);
    push(hw, b);
    push(-hw, b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  applyPlanarUV(geometry, hw, hd);
  geometry.computeVertexNormals();
  return geometry;
}

/** The roof's upper surface, drawn as a polyline across the depth. */
function roofProfile(
  shape: RoofShape,
  hd: number,
  rise: number,
): THREE.Vector2[] {
  if (shape === "mansard") {
    // Steep lower pitch breaking to a shallow upper pitch — the shape that
    // buys usable floor area in the attic.
    const knee = rise * 0.62;
    const brk = hd * 0.55;
    return [
      new THREE.Vector2(-hd, 0),
      new THREE.Vector2(-brk, knee),
      new THREE.Vector2(0, rise),
      new THREE.Vector2(brk, knee),
      new THREE.Vector2(hd, 0),
    ];
  }
  return [
    new THREE.Vector2(-hd, 0),
    new THREE.Vector2(0, rise),
    new THREE.Vector2(hd, 0),
  ];
}

function ridged(
  shape: RoofShape,
  hw: number,
  hd: number,
  rise: number,
): THREE.BufferGeometry {
  return shellFromProfile(roofProfile(shape, hd, rise), hw, hd);
}

function flat(hw: number, hd: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(hw * 2, FLAT_SLAB_M, hd * 2);
  geometry.translate(0, FLAT_SLAB_M / 2, 0);
  applyPlanarUV(geometry, hw, hd);
  return geometry;
}

/** Four sloping planes meeting a ridge shorter than the building. */
function hip(hw: number, hd: number, rise: number): THREE.BufferGeometry {
  // The ridge is inset by the shorter half-span, which is what makes the hip
  // ends run at 45° like a real framed hip.
  const alongX = hw >= hd;
  const inset = Math.abs(hw - hd);
  const ridgeA = alongX
    ? new THREE.Vector3(-inset, rise, 0)
    : new THREE.Vector3(0, rise, -inset);
  const ridgeB = alongX
    ? new THREE.Vector3(inset, rise, 0)
    : new THREE.Vector3(0, rise, inset);

  const c0 = new THREE.Vector3(-hw, 0, -hd);
  const c1 = new THREE.Vector3(hw, 0, -hd);
  const c2 = new THREE.Vector3(hw, 0, hd);
  const c3 = new THREE.Vector3(-hw, 0, hd);

  const tris: THREE.Vector3[][] = alongX
    ? [
        [c0, ridgeB, c1],
        [c0, ridgeA, ridgeB],
        [c3, c2, ridgeB],
        [c3, ridgeB, ridgeA],
        [c0, c3, ridgeA],
        [c1, ridgeB, c2],
      ]
    : [
        [c0, c1, ridgeA],
        [c1, ridgeB, ridgeA],
        [c3, ridgeA, c2],
        [c2, ridgeA, ridgeB],
        [c0, ridgeA, c3],
        [c1, c2, ridgeB],
      ];

  const positions: number[] = [];
  for (const tri of tris) {
    for (const v of tri) positions.push(v.x, v.y, v.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  applyPlanarUV(geometry, hw, hd);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Height of the roof underside above the eaves plane, at a given distance
 * from the ridge. The gable wall has to be built from this exact curve: the
 * roof starts its slope out at the overhanging eaves, so by the time it
 * crosses the wall it is already higher than the wall's own pitch would put
 * it. Using the wall's pitch instead leaves a strip of daylight under the roof.
 */
export function roofUndersideAt(
  shape: RoofShape,
  dims: RoofDims,
  z: number,
): number {
  const { halfDepth: hd, rise } = dims;
  const a = Math.min(Math.abs(z), hd);
  if (shape === "flat") return 0;
  if (shape === "mansard") {
    const knee = rise * 0.62;
    const brk = hd * 0.55;
    return a >= brk
      ? (knee * (hd - a)) / (hd - brk)
      : knee + (rise - knee) * (1 - a / brk);
  }
  return rise * (1 - a / hd);
}

/**
 * Outline of the wall that closes off the end of a ridged roof, from the wall
 * top up to the roof underside. Sampled rather than solved so gable and
 * mansard share one path.
 */
export function endWallProfile(
  shape: RoofShape,
  dims: RoofDims,
  wallHalfDepth: number,
  samples = 24,
): THREE.Vector2[] {
  const wd = wallHalfDepth;
  // Held a few centimetres clear of the roof surface: built exactly to it,
  // the two coplanar faces flicker against each other.
  const clearance = 0.05;
  const points: THREE.Vector2[] = [
    new THREE.Vector2(-wd, 0),
    new THREE.Vector2(wd, 0),
  ];
  for (let i = 0; i <= samples; i++) {
    const z = wd - (2 * wd * i) / samples;
    const y = Math.max(0.01, roofUndersideAt(shape, dims, z) - clearance);
    points.push(new THREE.Vector2(z, y));
  }
  return points;
}

export function createRoofGeometry(
  shape: RoofShape,
  dims: RoofDims,
): THREE.BufferGeometry {
  const { halfWidth: hw, halfDepth: hd, rise } = dims;
  switch (shape) {
    case "gable":
    case "mansard":
      return ridged(shape, hw, hd, rise);
    case "hip":
      return hip(hw, hd, rise);
    case "flat":
      return flat(hw, hd);
  }
}

export const ROOF_SHAPE_LABELS: Record<RoofShape, string> = {
  gable: "Двускатная",
  hip: "Вальмовая",
  mansard: "Мансардная",
  flat: "Плоская",
};
