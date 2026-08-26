import * as THREE from "three";

/**
 * The ground the house stands on — the same graph paper the page is drawn on.
 *
 * The CSS sheet rules a fine line every 28px with a bold one every fifth, in
 * white at 13% and 22%. This builds the same ruling as a texture in metres so
 * the canvas and the page read as one surface.
 *
 * A screen-fixed 2D grid and a perspective 3D grid cannot be locked together
 * at every camera angle — that is geometry, not effort. What is matched is the
 * part that carries the impression: identical colours, the same every-fifth
 * rule, and a cell size chosen so that at the editor's default framing the
 * apparent pitch lands on ~28px. Orbit away and the two diverge slightly; at
 * rest they read as one sheet.
 */

/** One fine cell, in metres. Five of these make a major division. */
export const GRID_CELL_M = 0.5;
export const GRID_MAJOR_EVERY = 5;

/** Pixels per major division in the texture. Power of two for mipmapping. */
const TILE_PX = 256;

const FINE = "rgba(255,255,255,0.13)";
const BOLD = "rgba(255,255,255,0.22)";

let cached: THREE.CanvasTexture | null = null;

/**
 * One tile covers a single major division, so the texture repeats every
 * GRID_CELL_M × GRID_MAJOR_EVERY metres. The bold line is drawn on the tile's
 * leading edges; the repeat then places one every fifth fine line.
 */
export function getBlueprintGridTexture(): THREE.CanvasTexture {
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TILE_PX;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, TILE_PX, TILE_PX);
    const step = TILE_PX / GRID_MAJOR_EVERY;

    // Fine ruling. Line width is derived rather than guessed: a CSS hairline
    // at the default framing is about this fraction of a cell.
    ctx.strokeStyle = FINE;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    for (let i = 1; i < GRID_MAJOR_EVERY; i++) {
      const p = i * step;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, TILE_PX);
      ctx.moveTo(0, p);
      ctx.lineTo(TILE_PX, p);
    }
    ctx.stroke();

    // Every fifth line, on the tile's own edges.
    ctx.strokeStyle = BOLD;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, TILE_PX);
    ctx.moveTo(0, 0.5);
    ctx.lineTo(TILE_PX, 0.5);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  // The ground is seen at a grazing angle across most of the frame, which is
  // exactly where an unfiltered grid turns into moiré.
  texture.anisotropy = 8;
  cached = texture;
  return texture;
}
