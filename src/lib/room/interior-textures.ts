import * as THREE from "three";

/**
 * Seamless surface textures for the room, drawn rather than photographed.
 *
 * The catalogue photographs cannot be used here and never could: they are
 * *photographs*, with a vignette and a defocused band baked in so they read
 * as a product shot on a card. Tile one across a wall and every one of those
 * baked-in gradients repeats, which is exactly the square grid that made
 * wallpaper look like wallpaper samples pinned to a wall instead of wallpaper.
 *
 * These are built to tile instead. Two rules make that true:
 *
 *  1. Nothing global. No vignette, no corner-to-corner gradient, no lighting
 *     — light belongs to the scene, not to the surface.
 *  2. Anything scattered is stamped nine times, at every wrap of the canvas,
 *     so a mark that runs off one edge comes back on the other. Anything on a
 *     grid uses a period that divides the canvas exactly.
 *
 * One tile spans a stated number of real metres, and the room's UVs are in
 * metres, so the repeat is just 1/metres — the pattern is the size the real
 * material is, on a 2 m wall and on a 9 m one alike.
 */

const PX = 512;

/** How much real wall one tile spans, in metres. */
export const INTERIOR_TILE_M: Record<string, number> = {
  // Four boards to a tile, at the real 194 mm board width.
  laminate: 0.78,
  planken: 0.78,
  // Two 600 mm tiles across, plus their joints.
  porcelain: 1.21,
  // Two 600 mm tiles across, four 300 mm courses down.
  "tile-gloss": 1.21,
  "paint-matt": 0.55,
  wallpaper: 0.64,
  travertine: 1.05,
  "stretch-ceiling": 2.2,
  "gypsum-board": 1.25,
  underlay: 0.62,
  "mineral-wool": 0.6,
  membrane: 1.0,
};

type Draw = (
  ctx: CanvasRenderingContext2D,
  tint: string,
  r: () => number,
) => void;

// ------------------------------------------------------------------ helpers

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0, 1));
  return `#${c.getHexString()}`;
}

/**
 * Runs `paint` at all nine wraps of the canvas.
 *
 * This is what makes a scattered mark seamless: a speckle drawn near the left
 * edge is drawn again one canvas-width to the right, so the half of it that
 * falls off the edge is the half that arrives on the other side.
 */
function wrapped(ctx: CanvasRenderingContext2D, paint: () => void): void {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      ctx.save();
      ctx.translate(dx * PX, dy * PX);
      paint();
      ctx.restore();
    }
  }
}

/** Fine speckle, the thing that keeps a flat colour from looking like plastic. */
function speckle(
  ctx: CanvasRenderingContext2D,
  r: () => number,
  count: number,
  radius: number,
  light: number,
  dark: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  for (let i = 0; i < count; i++) {
    const x = r() * PX;
    const y = r() * PX;
    const rad = radius * (0.4 + r());
    const up = r() > 0.5;
    ctx.fillStyle = up
      ? `rgba(255,255,255,${r() * light})`
      : `rgba(0,0,0,${r() * dark})`;
    wrapped(ctx, () => {
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
}

/** A horizontal band that also paints its own wrap at the top edge. */
function band(
  ctx: CanvasRenderingContext2D,
  y: number,
  h: number,
  style: string | CanvasGradient,
): void {
  ctx.fillStyle = style;
  ctx.fillRect(0, y, PX, h);
  if (y + h > PX) ctx.fillRect(0, y - PX, PX, h);
  if (y < 0) ctx.fillRect(0, y + PX, PX, h);
}

// ------------------------------------------------------------------ рисунки

const DRAWERS: Record<string, Draw> = {
  laminate(ctx, tint, r) {
    const rows = 4;
    const rowH = PX / rows;
    for (let i = 0; i < rows; i++) {
      const y = i * rowH;
      const base = shade(tint, (r() - 0.5) * 0.06);
      ctx.fillStyle = base;
      ctx.fillRect(0, y, PX, rowH);

      // Grain runs the length of the board, so it spans the full width and
      // wraps by construction.
      for (let g = 0; g < 34; g++) {
        const gy = y + r() * rowH;
        ctx.strokeStyle = `rgba(${r() > 0.55 ? "0,0,0" : "255,255,255"},${0.04 + r() * 0.1})`;
        ctx.lineWidth = 0.5 + r() * 1.6;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(PX * 0.3, gy + (r() - 0.5) * 9, PX * 0.7, gy + (r() - 0.5) * 9, PX, gy);
        ctx.stroke();
      }

      // One end joint per course, staggered — the give-away that this is a
      // floor of boards and not a printed sheet.
      const seam = PX * (i % 2 === 0 ? 0.63 : 0.21);
      ctx.fillStyle = "rgba(0,0,0,0.36)";
      ctx.fillRect(seam, y + 2, 1.6, rowH - 4);
      ctx.fillStyle = shade(base, 0.26);
      ctx.fillRect(seam + 1.6, y + 2, 1, rowH - 4);

      // The V-groove between courses: shadow, then the lit chamfer below it.
      const g = ctx.createLinearGradient(0, y + rowH - 4, 0, y + rowH + 4);
      g.addColorStop(0, "rgba(0,0,0,0.5)");
      g.addColorStop(0.5, "rgba(0,0,0,0.62)");
      g.addColorStop(1, `rgba(255,255,255,0.3)`);
      band(ctx, y + rowH - 4, 8, g);
    }
    speckle(ctx, r, 900, 2, 0.1, 0.07);
  },

  planken(ctx, tint, r) {
    DRAWERS.laminate(ctx, tint, r);
    // Real oak, so it gets knots — and they are stamped wrapped, because a
    // knot half off the edge is the first thing that gives a tile away.
    for (let i = 0; i < 5; i++) {
      const kx = r() * PX;
      const ky = r() * PX;
      const kr = 5 + r() * 7;
      wrapped(ctx, () => {
        for (let ring = 5; ring > 0; ring--) {
          ctx.strokeStyle = `rgba(0,0,0,${0.06 + ring * 0.02})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(kx, ky, kr * (ring / 5), kr * 0.62 * (ring / 5), 0.4, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    }
  },

  porcelain(ctx, tint, r) {
    const cell = PX / 2;
    const joint = 3;
    ctx.fillStyle = shade(tint, -0.42);
    ctx.fillRect(0, 0, PX, PX);

    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const x = tx * cell + joint / 2;
        const y = ty * cell + joint / 2;
        const w = cell - joint;
        const base = shade(tint, (r() - 0.5) * 0.08);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, w);
        ctx.clip();
        ctx.fillStyle = base;
        ctx.fillRect(x, y, w, w);
        // Cloudiness, clipped to its own tile, so nothing crosses a joint.
        for (let i = 0; i < 18; i++) {
          const px = x + r() * w;
          const py = y + r() * w;
          const rad = w * (0.12 + r() * 0.3);
          const cloud = ctx.createRadialGradient(px, py, 0, px, py, rad);
          cloud.addColorStop(0, `rgba(${r() > 0.5 ? "255,255,255" : "0,0,0"},0.16)`);
          cloud.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = cloud;
          ctx.fillRect(x, y, w, w);
        }
        for (let i = 0; i < 7; i++) {
          let px = x - 4;
          let py = y + r() * w;
          ctx.strokeStyle = `rgba(${r() > 0.6 ? "255,255,255" : "0,0,0"},${0.1 + r() * 0.14})`;
          ctx.lineWidth = 0.7 + r() * 1.2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          while (px < x + w + 4) {
            px += w * (0.09 + r() * 0.13);
            py += (r() - 0.5) * w * 0.11;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    // The joint at the tile's own edge is drawn on both sides of the wrap.
    ctx.fillStyle = shade(tint, -0.42);
    band(ctx, -joint / 2, joint, shade(tint, -0.42));
    ctx.fillRect(0, cell - joint / 2, PX, joint);
    ctx.fillRect(cell - joint / 2, 0, joint, PX);
    ctx.fillRect(-joint / 2, 0, joint, PX);
    ctx.fillRect(PX - joint / 2, 0, joint, PX);
    speckle(ctx, r, 1400, 1.6, 0.09, 0.07);
  },

  "tile-gloss"(ctx, tint, r) {
    const tw = PX / 2;
    const th = PX / 4;
    const joint = 4;
    ctx.fillStyle = shade(tint, -0.34);
    ctx.fillRect(0, 0, PX, PX);

    for (let row = 0; row < 4; row++) {
      const offset = row % 2 === 0 ? 0 : tw / 2;
      for (let col = -1; col < 3; col++) {
        const x = col * tw + offset;
        const y = row * th;
        const base = shade(tint, 0.06 + (r() - 0.5) * 0.04);
        const draw = () => {
          const g = ctx.createLinearGradient(x, y, x + tw * 0.5, y + th);
          g.addColorStop(0, shade(base, 0.13));
          g.addColorStop(0.55, base);
          g.addColorStop(1, shade(base, -0.11));
          ctx.fillStyle = g;
          ctx.fillRect(x + joint / 2, y + joint / 2, tw - joint, th - joint);

          // The hard edge of the highlight is what says "glaze".
          const spec = ctx.createLinearGradient(x, y, x + tw * 0.3, y + th);
          spec.addColorStop(0, "rgba(255,255,255,0.5)");
          spec.addColorStop(0.14, "rgba(255,255,255,0.22)");
          spec.addColorStop(0.17, "rgba(255,255,255,0.04)");
          spec.addColorStop(0.62, "rgba(255,255,255,0)");
          spec.addColorStop(1, "rgba(255,255,255,0.18)");
          ctx.fillStyle = spec;
          ctx.fillRect(x + joint / 2, y + joint / 2, tw - joint, th - joint);

          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.fillRect(x + joint / 2, y + joint / 2, tw - joint, 2);
          ctx.fillStyle = "rgba(0,0,0,0.24)";
          ctx.fillRect(x + joint / 2, y + th - joint / 2 - 2, tw - joint, 2);
        };
        draw();
        // Courses run past the right edge on the offset rows; paint the wrap.
        ctx.save();
        ctx.translate(PX, 0);
        draw();
        ctx.restore();
      }
    }
    speckle(ctx, r, 500, 1.2, 0.06, 0.04);
  },

  "paint-matt"(ctx, tint, r) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, PX, PX);
    // Orange peel from the roller, and nothing else: matte paint has no
    // structure at this distance, and inventing some is what makes a wall
    // look like stone.
    speckle(ctx, r, 9000, 2.6, 0.16, 0.09);
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    for (let i = 0; i < 700; i++) {
      const x = r() * PX;
      const y = r() * PX;
      const len = 5 + r() * 18;
      ctx.strokeStyle = `rgba(${r() > 0.5 ? "255,255,255" : "0,0,0"},${r() * 0.12})`;
      ctx.lineWidth = 0.5 + r();
      wrapped(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 4, y + len);
        ctx.stroke();
      });
    }
    ctx.restore();
  },

  wallpaper(ctx, tint, r) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, PX, PX);

    // Woven base: orthogonal threads on periods that divide the canvas.
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    for (let x = 0; x < PX; x += 8) {
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(x, 0, 2, PX);
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(x + 2, 0, 2, PX);
    }
    for (let y = 0; y < PX; y += 8) {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(0, y, PX, 2);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, y + 2, PX, 2);
    }
    ctx.restore();

    // Embossed repeat, on a half-drop. Eight columns and eight rows, both
    // even, so the half-drop meets itself at the wrap.
    const step = PX / 8;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const cx = col * step + (row % 2 ? step / 2 : 0) + step / 2;
        const cy = row * step + step / 2;
        const rad = step * 0.32;
        for (const [dy, colour] of [
          [-rad * 0.3, "rgba(0,0,0,0.17)"],
          [rad * 0.3, "rgba(255,255,255,0.24)"],
        ] as const) {
          wrapped(ctx, () => {
            const g = ctx.createRadialGradient(cx, cy + dy, 0, cx, cy + dy, rad);
            g.addColorStop(0, colour);
            g.addColorStop(1, colour.replace(/[0-9.]+\)$/, "0)"));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(cx, cy + dy, rad, rad * 0.85, 0, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }
    }
    speckle(ctx, r, 2600, 1.8, 0.1, 0.07);
  },

  travertine(ctx, tint, r) {
    ctx.fillStyle = shade(tint, -0.1);
    ctx.fillRect(0, 0, PX, PX);
    // Trowel passes.
    for (let i = 0; i < 220; i++) {
      const x = r() * PX;
      const y = r() * PX;
      const len = PX * (0.1 + r() * 0.24);
      const wide = PX * (0.04 + r() * 0.07);
      const angle = (r() - 0.5) * 0.5;
      const face = shade(tint, (r() - 0.4) * 0.4);
      wrapped(ctx, () => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        const g = ctx.createLinearGradient(0, -wide / 2, 0, wide / 2);
        g.addColorStop(0, `${face}00`);
        g.addColorStop(0.45, face);
        g.addColorStop(1, `${face}00`);
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = g;
        ctx.fillRect(0, -wide / 2, len, wide);
        ctx.restore();
      });
    }
    // Pores.
    for (let i = 0; i < 700; i++) {
      const x = r() * PX;
      const y = r() * PX;
      const rad = 1.4 + r() * 4;
      const dark = 0.14 + r() * 0.22;
      const light = 0.12 + r() * 0.18;
      wrapped(ctx, () => {
        ctx.fillStyle = `rgba(0,0,0,${dark})`;
        ctx.beginPath();
        ctx.ellipse(x, y, rad * 1.5, rad * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${light})`;
        ctx.beginPath();
        ctx.ellipse(x, y - rad * 0.7, rad * 1.2, rad * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  },

  "stretch-ceiling"(ctx, tint, r) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, PX, PX);
    // Almost nothing, on purpose. A stretched PVC sheet has no texture; all
    // it has is a very slight unevenness in the tension.
    for (let i = 0; i < 14; i++) {
      const x = r() * PX;
      const y = r() * PX;
      const rad = PX * (0.2 + r() * 0.3);
      const up = r() > 0.5;
      wrapped(ctx, () => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, up ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    speckle(ctx, r, 600, 1.4, 0.04, 0.03);
  },

  "gypsum-board"(ctx, tint, r) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, PX, PX);
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    for (let i = 0; i < 2600; i++) {
      const x = r() * PX;
      const y = r() * PX;
      const len = 4 + r() * 14;
      const angle = (r() - 0.5) * 0.6;
      ctx.strokeStyle = `rgba(${r() > 0.5 ? "255,255,255" : "0,0,0"},${r() * 0.2})`;
      ctx.lineWidth = 0.4 + r() * 0.6;
      wrapped(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        ctx.stroke();
      });
    }
    ctx.restore();
    for (let i = 0; i < 26; i++) {
      const x = r() * PX;
      const y = r() * PX;
      const rad = 1 + r() * 2;
      wrapped(ctx, () => {
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        ctx.beginPath();
        ctx.ellipse(x, y, rad * 1.6, rad, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  },

  underlay(ctx, tint, r) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, PX, PX);
    // Embossed cells, on a period that divides the canvas.
    const cell = PX / 16;
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = "rgba(0,0,0,0.09)";
      ctx.fillRect(i * cell, 0, 1.6, PX);
      ctx.fillRect(0, i * cell, PX, 1.6);
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      ctx.fillRect(i * cell + 1.6, 0, 1.2, PX);
      ctx.fillRect(0, i * cell + 1.6, PX, 1.2);
    }
    // Foil catches the light in patches rather than in lines.
    for (let i = 0; i < 30; i++) {
      const x = r() * PX;
      const y = r() * PX;
      const rad = PX * (0.04 + r() * 0.1);
      wrapped(ctx, () => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `rgba(255,255,255,${0.08 + r() * 0.12})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  },

  "mineral-wool"(ctx, tint, r) {
    ctx.fillStyle = shade(tint, -0.2);
    ctx.fillRect(0, 0, PX, PX);
    for (let i = 0; i < 2600; i++) {
      const x = r() * PX;
      const y = r() * PX;
      const len = 14 + r() * 46;
      const angle = r() * Math.PI;
      ctx.strokeStyle = `rgba(${r() > 0.42 ? "255,255,255" : "0,0,0"},${0.05 + r() * 0.16})`;
      ctx.lineWidth = 0.6 + r() * 1.4;
      wrapped(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        ctx.stroke();
      });
    }
    for (let i = 0; i < 60; i++) {
      const x = r() * PX;
      const y = r() * PX;
      const rad = 3 + r() * 9;
      wrapped(ctx, () => {
        ctx.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  },

  membrane(ctx, tint, r) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, PX, PX);
    for (let i = 0; i < 5200; i++) {
      const x = r() * PX;
      const y = r() * PX;
      const rad = 0.7 + r() * 2.4;
      const up = r() > 0.5;
      wrapped(ctx, () => {
        ctx.fillStyle = up
          ? `rgba(255,255,255,${r() * 0.2})`
          : `rgba(0,0,0,${r() * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  },
};

// ------------------------------------------------------------------- фасад

const cache = new Map<string, THREE.CanvasTexture>();

/** Whether a finish has a drawn surface, or has to fall back to flat colour. */
export function hasInteriorTexture(kind: string): boolean {
  return kind in DRAWERS;
}

/**
 * The tiling surface for one finish.
 *
 * Cached by kind and tint: two products drawn the same way in the same colour
 * are the same texture, and a room usually wears one finish on four walls.
 */
export function interiorTexture(
  kind: string,
  tint: string,
): THREE.CanvasTexture | null {
  const draw = DRAWERS[kind];
  if (!draw) return null;

  const key = `${kind}|${tint}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = PX;
  canvas.height = PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Seeded off the kind so the same material is the same drawing every time —
  // a wall that re-randomises when you change its colour reads as a glitch.
  let seed = 7;
  for (const ch of kind) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;

  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, PX, PX);
  draw(ctx, tint, rng(seed));

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

export function interiorTileM(kind: string): number {
  return INTERIOR_TILE_M[kind] ?? 1;
}
