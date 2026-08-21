import * as THREE from "three";

/**
 * Textures for the drafting table the model sits on.
 *
 * These are single sheets rather than repeating material swatches, so they
 * live apart from textures.ts: a blueprint has a border, a title block and a
 * centre, and tiling it would destroy all three.
 *
 * The blue is sampled from the hero clip's final frame (#11335d in the field,
 * lifting to #183b65 under the lamp) so the table the camera lands on and the
 * table the model sits on are recognisably the same sheet of paper. It stays
 * scene material: it never reaches a button, a border or any UI chrome.
 */

const BLUEPRINT_BLUE = "#11335d";
const BLUEPRINT_LIT = "#1b4272";
const INK = "255, 255, 255";

function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  alpha: number,
  width = 1,
) {
  ctx.strokeStyle = `rgba(${INK}, ${alpha})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** The drawing the house is being designed on. */
export function createBlueprintTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 768;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Paper, with the lamp falling across the middle.
  ctx.fillStyle = BLUEPRINT_BLUE;
  ctx.fillRect(0, 0, W, H);
  const lamp = ctx.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.42, W * 0.62);
  lamp.addColorStop(0, BLUEPRINT_LIT);
  lamp.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, W, H);

  const minor = 16;
  for (let x = 0; x <= W; x += minor) line(ctx, x, 0, x, H, 0.11);
  for (let y = 0; y <= H; y += minor) line(ctx, 0, y, W, y, 0.11);

  const major = minor * 4;
  for (let x = 0; x <= W; x += major) line(ctx, x, 0, x, H, 0.26);
  for (let y = 0; y <= H; y += major) line(ctx, 0, y, W, y, 0.26);

  // Sheet border and inner frame.
  const m = 30;
  ctx.strokeStyle = `rgba(${INK}, 0.5)`;
  ctx.lineWidth = 3;
  ctx.strokeRect(m, m, W - m * 2, H - m * 2);
  ctx.strokeStyle = `rgba(${INK}, 0.28)`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(m + 11, m + 11, W - (m + 11) * 2, H - (m + 11) * 2);

  // Centre lines and setting-out diagonals — the marks that make it read as a
  // drawing rather than as graph paper.
  line(ctx, W / 2, m, W / 2, H - m, 0.3, 1.5);
  line(ctx, m, H / 2, W - m, H / 2, 0.3, 1.5);
  line(ctx, W * 0.24, H * 0.2, W * 0.76, H * 0.8, 0.13);
  line(ctx, W * 0.76, H * 0.2, W * 0.24, H * 0.8, 0.13);

  // A plan outline in the middle of the sheet.
  ctx.strokeStyle = `rgba(${INK}, 0.42)`;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(W * 0.3, H * 0.28, W * 0.4, H * 0.44);
  ctx.strokeStyle = `rgba(${INK}, 0.24)`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(W * 0.34, H * 0.33, W * 0.32, H * 0.34);

  // Dimension ticks along the top edge.
  for (let x = m + 40; x < W - m - 30; x += 48) {
    line(ctx, x, m + 11, x, m + 23, 0.3);
  }

  // Title block.
  const tbW = 210;
  const tbH = 75;
  const tbX = W - m - 12 - tbW;
  const tbY = H - m - 12 - tbH;
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(tbX, tbY, tbW, tbH);
  ctx.strokeStyle = `rgba(${INK}, 0.45)`;
  ctx.lineWidth = 2;
  ctx.strokeRect(tbX, tbY, tbW, tbH);
  line(ctx, tbX, tbY + 23, tbX + tbW, tbY + 23, 0.3);
  line(ctx, tbX + 125, tbY + 23, tbX + 125, tbY + tbH, 0.3);
  ctx.fillStyle = `rgba(${INK}, 0.62)`;
  ctx.font = "600 13px sans-serif";
  ctx.fillText("OPUS GROUP", tbX + 9, tbY + 16);
  ctx.font = "400 9px sans-serif";
  ctx.fillStyle = `rgba(${INK}, 0.4)`;
  ctx.fillText("ПРОЕКТ ДОМА", tbX + 9, tbY + 39);
  ctx.fillText("М 1:100", tbX + 9, tbY + 54);
  ctx.fillText("ЛИСТ 1", tbX + 134, tbY + 39);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Face of the yellow scale rule, with its graduations. */
export function createRulerTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Draughtsman's yellow, warmed slightly along its length.
  const body = ctx.createLinearGradient(0, 0, 0, H);
  body.addColorStop(0, "#E8B93C");
  body.addColorStop(0.45, "#F5CE5A");
  body.addColorStop(1, "#C9992A");
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(60,40,10,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);

  ctx.fillStyle = "rgba(40,28,8,0.85)";
  ctx.strokeStyle = "rgba(40,28,8,0.85)";
  ctx.font = "600 17px sans-serif";
  const step = W / 64;
  for (let i = 0; i <= 64; i++) {
    const x = i * step;
    const major = i % 8 === 0;
    const mid = i % 4 === 0;
    const len = major ? H * 0.46 : mid ? H * 0.3 : H * 0.17;
    ctx.lineWidth = major ? 3.5 : 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, len);
    ctx.stroke();
    if (major && i > 0 && i < 64) {
      ctx.fillText(String(i * 5), x + 4, H * 0.72);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Timber of the drafting table itself. */
export function createDeskTexture(): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "#2A2018";
  ctx.fillRect(0, 0, S, S);
  let seed = 9;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(${rnd() > 0.5 ? "80,62,44" : "22,16,11"},${0.15 + rnd() * 0.2})`;
    ctx.lineWidth = 1 + rnd() * 2.5;
    const y = rnd() * S;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(S * 0.3, y + (rnd() - 0.5) * 14, S * 0.7, y + (rnd() - 0.5) * 14, S, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The desk textures are the same every time, and building them costs a
 * noticeable block of main thread — measured at over a second on a software
 * renderer. They are therefore built once and shared for the life of the
 * page, so leaving the editor and coming back is free.
 *
 * Deliberately never disposed: these are shared assets rather than per-mount
 * resources, and disposing one would leave the next mount with a dead
 * texture. The set retains a few megabytes, which is far cheaper than
 * rebuilding it on every visit.
 */
let cache: {
  blueprint: THREE.CanvasTexture;
  ruler: THREE.CanvasTexture;
  desk: THREE.CanvasTexture;
} | null = null;

export function getDeskTextures() {
  if (!cache) {
    cache = {
      blueprint: createBlueprintTexture(),
      ruler: createRulerTexture(),
      desk: createDeskTexture(),
    };
  }
  return cache;
}
