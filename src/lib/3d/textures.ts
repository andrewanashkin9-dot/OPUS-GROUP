import * as THREE from "three";
import type { TextureId } from "./types";

/**
 * Material surfaces are drawn procedurally onto a canvas rather than shipped
 * as image files: every pattern has to be re-tinted whenever the user picks a
 * new colour, and a bitmap per colour-per-material would be hundreds of
 * assets. Drawing them means colour and texture compose freely.
 *
 * Each pattern declares the real-world size of one tile so the repeat can be
 * derived from the surface's actual metres — brick courses stay brick-sized
 * on a 9 m wall and on a 2 m one.
 */

const CANVAS_PX = 256;

/** Real-world size in metres that one texture tile represents. */
const TILE_METRES: Record<TextureId, number> = {
  "brick-running": 1.0,
  "brick-clinker": 1.0,
  "brick-aged": 1.0,
  block: 1.8,
  plaster: 1.2,
  planken: 1.4,
  panel: 2.0,
  "tile-metal": 1.4,
  "tile-shingle": 1.2,
  "tile-wave": 1.0,
  seam: 1.6,
  profnastil: 1.0,
  shtaketnik: 1.0,
  forged: 2.0,
  concrete: 2.0,
  glass: 2.0,
  "wood-door": 1.2,
  "steel-door": 1.2,
};

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0, 1));
  return `#${c.getHexString()}`;
}

/** Deterministic pseudo-random so a texture looks the same on every render. */
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function drawBrickBond(
  ctx: CanvasRenderingContext2D,
  color: string,
  opts: { rows: number; cols: number; mortar: number; jitter: number },
) {
  const { rows, cols, mortar, jitter } = opts;
  ctx.fillStyle = shade(color, -0.18);
  ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

  const h = CANVAS_PX / rows;
  const w = CANVAS_PX / cols;
  const rng = makeRng(7);

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : w / 2;
    for (let c = -1; c <= cols; c++) {
      const x = c * w + offset;
      const y = r * h;
      ctx.fillStyle = shade(color, (rng() - 0.5) * jitter);
      ctx.fillRect(x + mortar, y + mortar, w - mortar * 2, h - mortar * 2);
    }
  }
}

const PAINTERS: Record<
  TextureId,
  (ctx: CanvasRenderingContext2D, color: string) => void
> = {
  "brick-running": (ctx, color) =>
    drawBrickBond(ctx, color, { rows: 8, cols: 4, mortar: 2, jitter: 0.06 }),

  "brick-clinker": (ctx, color) =>
    drawBrickBond(ctx, color, { rows: 12, cols: 3, mortar: 1.5, jitter: 0.05 }),

  "brick-aged": (ctx, color) => {
    drawBrickBond(ctx, color, { rows: 8, cols: 4, mortar: 3, jitter: 0.14 });
    const rng = makeRng(21);
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = rng() > 0.5 ? shade(color, -0.25) : shade(color, 0.2);
      ctx.fillRect(rng() * CANVAS_PX, rng() * CANVAS_PX, 3, 2);
    }
    ctx.globalAlpha = 1;
  },

  block: (ctx, color) =>
    drawBrickBond(ctx, color, { rows: 4, cols: 2, mortar: 2, jitter: 0.03 }),

  plaster: (ctx, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    const rng = makeRng(3);
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 4200; i++) {
      ctx.fillStyle = rng() > 0.5 ? shade(color, -0.12) : shade(color, 0.12);
      ctx.fillRect(rng() * CANVAS_PX, rng() * CANVAS_PX, 2, 2);
    }
    ctx.globalAlpha = 1;
  },

  planken: (ctx, color) => {
    ctx.fillStyle = shade(color, -0.2);
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    const boards = 7;
    const h = CANVAS_PX / boards;
    const rng = makeRng(11);
    for (let i = 0; i < boards; i++) {
      ctx.fillStyle = shade(color, (rng() - 0.5) * 0.1);
      ctx.fillRect(0, i * h + 1.5, CANVAS_PX, h - 3);
      // grain
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = shade(color, -0.3);
      for (let g = 0; g < 3; g++) {
        ctx.beginPath();
        const y = i * h + 4 + rng() * (h - 8);
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(70, y + 2, 160, y - 2, CANVAS_PX, y + 1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  },

  panel: (ctx, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    ctx.strokeStyle = shade(color, -0.22);
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, CANVAS_PX / 2, CANVAS_PX);
    ctx.strokeRect(CANVAS_PX / 2, 0, CANVAS_PX / 2, CANVAS_PX);
  },

  "tile-metal": (ctx, color) => {
    // Metallocherepitsa: stepped horizontal courses with vertical seams.
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    const rows = 6;
    const h = CANVAS_PX / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * h;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, shade(color, 0.1));
      g.addColorStop(0.62, color);
      g.addColorStop(0.85, shade(color, -0.2));
      g.addColorStop(1, shade(color, -0.05));
      ctx.fillStyle = g;
      ctx.fillRect(0, y, CANVAS_PX, h);
      ctx.strokeStyle = shade(color, -0.3);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y + h - 1);
      ctx.lineTo(CANVAS_PX, y + h - 1);
      ctx.stroke();
    }
    ctx.strokeStyle = shade(color, -0.16);
    ctx.lineWidth = 2;
    for (let c = 1; c < 4; c++) {
      const x = (CANVAS_PX / 4) * c;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_PX);
      ctx.stroke();
    }
  },

  "tile-shingle": (ctx, color) => {
    ctx.fillStyle = shade(color, -0.24);
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    const rows = 8;
    const h = CANVAS_PX / rows;
    const tabW = CANVAS_PX / 6;
    const rng = makeRng(5);
    for (let r = 0; r < rows; r++) {
      const y = r * h;
      const offset = r % 2 === 0 ? 0 : tabW / 2;
      for (let c = -1; c <= 6; c++) {
        ctx.fillStyle = shade(color, (rng() - 0.5) * 0.16);
        ctx.beginPath();
        const x = c * tabW + offset;
        ctx.moveTo(x + 1, y + h - 1);
        ctx.lineTo(x + 1, y + h * 0.35);
        ctx.quadraticCurveTo(x + tabW / 2, y - h * 0.1, x + tabW - 1, y + h * 0.35);
        ctx.lineTo(x + tabW - 1, y + h - 1);
        ctx.closePath();
        ctx.fill();
      }
    }
  },

  "tile-wave": (ctx, color) => {
    ctx.fillStyle = shade(color, -0.25);
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    const cols = 6;
    const rows = 5;
    const w = CANVAS_PX / cols;
    const h = CANVAS_PX / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * w;
        const y = r * h;
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, shade(color, -0.16));
        g.addColorStop(0.45, shade(color, 0.1));
        g.addColorStop(1, shade(color, -0.2));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        ctx.lineTo(x, y + h * 0.4);
        ctx.quadraticCurveTo(x + w / 2, y - h * 0.25, x + w, y + h * 0.4);
        ctx.lineTo(x + w, y + h);
        ctx.closePath();
        ctx.fill();
      }
    }
  },

  seam: (ctx, color) => {
    // Standing-seam metal: broad flat trays divided by raised ribs.
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    const trays = 4;
    const w = CANVAS_PX / trays;
    for (let i = 0; i < trays; i++) {
      const x = i * w;
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, shade(color, -0.14));
      g.addColorStop(0.5, shade(color, 0.08));
      g.addColorStop(1, shade(color, -0.14));
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w, CANVAS_PX);
      ctx.fillStyle = shade(color, 0.16);
      ctx.fillRect(x + w - 3, 0, 3, CANVAS_PX);
    }
  },

  profnastil: (ctx, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    const ribs = 8;
    const w = CANVAS_PX / ribs;
    for (let i = 0; i < ribs; i++) {
      const x = i * w;
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, shade(color, -0.2));
      g.addColorStop(0.4, shade(color, 0.12));
      g.addColorStop(1, shade(color, -0.2));
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w, CANVAS_PX);
    }
  },

  shtaketnik: (ctx, color) => {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    const pickets = 6;
    const w = CANVAS_PX / pickets;
    for (let i = 0; i < pickets; i++) {
      const x = i * w;
      const g = ctx.createLinearGradient(x, 0, x + w * 0.7, 0);
      g.addColorStop(0, shade(color, -0.16));
      g.addColorStop(0.5, shade(color, 0.08));
      g.addColorStop(1, shade(color, -0.16));
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w * 0.7, CANVAS_PX);
    }
  },

  forged: (ctx, color) => {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    for (let i = 0; i < 4; i++) {
      const x = 24 + i * 68;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_PX);
      ctx.stroke();
    }
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.lineTo(CANVAS_PX, 40);
    ctx.moveTo(0, CANVAS_PX - 40);
    ctx.lineTo(CANVAS_PX, CANVAS_PX - 40);
    ctx.stroke();
  },

  concrete: (ctx, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    const rng = makeRng(17);
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = rng() > 0.5 ? shade(color, -0.16) : shade(color, 0.14);
      ctx.fillRect(rng() * CANVAS_PX, rng() * CANVAS_PX, 3, 3);
    }
    ctx.globalAlpha = 1;
  },

  glass: (ctx, color) => {
    const g = ctx.createLinearGradient(0, 0, CANVAS_PX, CANVAS_PX);
    g.addColorStop(0, shade(color, 0.16));
    g.addColorStop(0.5, color);
    g.addColorStop(1, shade(color, -0.2));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
  },

  "wood-door": (ctx, color) => {
    ctx.fillStyle = shade(color, -0.15);
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    ctx.fillStyle = color;
    ctx.fillRect(14, 14, CANVAS_PX - 28, CANVAS_PX - 28);
    ctx.strokeStyle = shade(color, -0.32);
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, CANVAS_PX - 60, CANVAS_PX * 0.42);
    ctx.strokeRect(30, CANVAS_PX * 0.56, CANVAS_PX - 60, CANVAS_PX * 0.32);
  },

  "steel-door": (ctx, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    ctx.strokeStyle = shade(color, -0.25);
    ctx.lineWidth = 5;
    ctx.strokeRect(22, 22, CANVAS_PX - 44, CANVAS_PX - 44);
    ctx.strokeStyle = shade(color, 0.1);
    ctx.lineWidth = 2;
    ctx.strokeRect(38, 38, CANVAS_PX - 76, CANVAS_PX - 76);
  },
};

/** Canvases are shared between meshes; only the Texture wrapper is per-use. */
const canvasCache = new Map<string, HTMLCanvasElement>();

function patternCanvas(textureId: TextureId, color: string): HTMLCanvasElement {
  const key = `${textureId}|${color}`;
  const cached = canvasCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    PAINTERS[textureId](ctx, color);
  }
  canvasCache.set(key, canvas);
  return canvas;
}

/**
 * Builds a texture for one surface. `widthM`/`heightM` are the real metres the
 * surface covers, so the pattern repeats at a believable physical scale.
 * The caller owns the result and must dispose it.
 */
export function createSurfaceTexture(
  textureId: TextureId,
  color: string,
  widthM: number,
  heightM: number,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(patternCanvas(textureId, color));
  const tile = TILE_METRES[textureId];
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    Math.max(1, Math.round(widthM / tile)),
    Math.max(1, Math.round(heightM / tile)),
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
