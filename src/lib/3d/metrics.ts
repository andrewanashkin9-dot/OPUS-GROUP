import * as THREE from "three";
import { roofDimensions } from "./roof-geometry";
import type { Facade, Opening, RoofGeometry, RoofShape, SceneModel } from "./types";

/**
 * One source of truth for the numbers that both the 3D scene and the bill of
 * materials depend on. If the renderer and the estimate compute areas
 * separately they drift, and the user is quoted for a roof they cannot see.
 */

export const WALL_THICKNESS_M = 0.4;
export const FENCE_HEIGHT_M = 1.8;
/** The fenced plot is proportionally larger than the house footprint. */
export const PLOT_SCALE = 1.8;

export interface Dimensions {
  widthM: number;
  depthM: number;
  heightM: number;
}

/** Metres of wall spanned by one facade. */
export function facadeSpanM(dims: Dimensions, facade: Facade): number {
  return facade === "front" || facade === "back" ? dims.widthM : dims.depthM;
}

function openingAreaM2(openings: Opening[], facade: Facade): number {
  return openings
    .filter((o) => o.facade === facade)
    .reduce((sum, o) => sum + o.widthM * o.heightM, 0);
}

/** Wall area of one facade, with window and door openings deducted. */
export function facadeAreaM2(
  dims: Dimensions,
  openings: Opening[],
  facade: Facade,
): number {
  const gross = facadeSpanM(dims, facade) * dims.heightM;
  return Math.max(0, round1(gross - openingAreaM2(openings, facade)));
}

/**
 * Every plane of a pitched roof sits at the same angle, so the true surface is
 * the footprint divided by the cosine of the pitch — exact for gable and hip
 * alike, and it is the footprint that carries the eaves overhang.
 */
export function roofAreaM2(dims: Dimensions, roof: RoofGeometry): number {
  const d = roofDimensions(
    dims.widthM,
    dims.depthM,
    roof.overhangM,
    roof.pitchDeg,
    roof.shape,
  );
  const projected = d.halfWidth * 2 * d.halfDepth * 2;
  if (roof.shape === "flat") return round1(projected);
  const cos = Math.cos(THREE.MathUtils.degToRad(roof.pitchDeg));
  const base = projected / Math.max(cos, 0.2);
  // A mansard breaks into two pitches, so it carries more surface than a
  // single-slope roof over the same footprint.
  return round1(roof.shape === "mansard" ? base * 1.25 : base);
}

export function foundationAreaM2(dims: Dimensions): number {
  return round1(dims.widthM * dims.depthM);
}

export function fenceLengthM(dims: Dimensions): number {
  return round1(2 * (dims.widthM * PLOT_SCALE + dims.depthM * PLOT_SCALE));
}

export function countOpenings(
  openings: Opening[],
  kind: Opening["kind"],
): number {
  return openings.filter((o) => o.kind === kind).length;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Recomputes every geometry-derived quantity on the model's nodes. */
export function withRecalculatedQuantities(model: SceneModel): SceneModel {
  return {
    ...model,
    nodes: model.nodes.map((node) => {
      switch (node.kind) {
        case "roof":
          return node.roof
            ? { ...node, quantity: roofAreaM2(model.dimensions, node.roof) }
            : node;
        case "foundation":
          return { ...node, quantity: foundationAreaM2(model.dimensions) };
        case "fence":
          return { ...node, quantity: fenceLengthM(model.dimensions) };
        case "window":
          return { ...node, quantity: countOpenings(model.openings, "window") };
        case "door":
          return { ...node, quantity: countOpenings(model.openings, "door") };
        default:
          return node;
      }
    }),
  };
}

export const FACADE_OF_NODE: Record<string, Facade> = {
  "node-facade-front": "front",
  "node-facade-back": "back",
  "node-facade-left": "left",
  "node-facade-right": "right",
};

export type { RoofShape };
