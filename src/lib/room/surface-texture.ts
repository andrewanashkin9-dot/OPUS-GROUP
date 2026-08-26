import type { CategoryId } from "../marketplace";

/**
 * How much real wall a catalogue photograph covers.
 *
 * The photographs are macro shots, so tiling them at an arbitrary scale is
 * what makes a 3D room look like a 3D render: laminate the size of floorboards
 * reads as a floor, laminate the size of a rug reads as wallpaper. These are
 * the width in metres that one tile spans; the height follows from the 4:3
 * frame, so nothing is stretched.
 */
const TILE_WIDTH_M: Partial<Record<CategoryId, number>> = {
  flooring: 1.3,
  wallcover: 1.05,
  ceiling: 1.8,
  soundproof: 1.2,
};

const DEFAULT_TILE_WIDTH_M = 1.2;

/** The photographs are rendered 4:3 and encoded at that ratio. */
const PHOTO_ASPECT = 4 / 3;

export function tileSizeM(category: CategoryId): { widthM: number; heightM: number } {
  const widthM = TILE_WIDTH_M[category] ?? DEFAULT_TILE_WIDTH_M;
  return { widthM, heightM: widthM / PHOTO_ASPECT };
}
