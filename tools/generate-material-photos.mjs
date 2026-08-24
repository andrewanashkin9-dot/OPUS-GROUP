/**
 * Renders one catalogue photograph per marketplace product and writes the
 * responsive set the product cards use.
 *
 * Run offline, not at build time — the output is committed:
 *
 *   node tools/generate-material-photos.mjs
 *
 * For each product in src/lib/marketplace-catalog.json it produces
 *
 *   public/assets/materials/<id>.webp      480 × 360
 *   public/assets/materials/<id>@2x.webp   960 × 720
 *   public/assets/materials/<id>.jpg       480 × 360   (fallback)
 *   public/assets/materials/<id>@2x.jpg    960 × 720   (fallback)
 *
 * Rendered at 2x and downsampled, so the 1x file is a real resample of a
 * higher-resolution original rather than the same drawing at half the size.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(root, "public/assets/materials");
const tmpDir = join(process.env.TMPDIR ?? "/tmp", "opus-material-photos");

const WIDTH_2X = 960;
const HEIGHT_2X = 720;

const ffmpeg =
  process.env.FFMPEG_PATH ??
  (() => {
    try {
      return execFileSync("which", ["ffmpeg"], { encoding: "utf8" }).trim();
    } catch {
      throw new Error(
        "ffmpeg не найден. Установите его или задайте FFMPEG_PATH=/path/to/ffmpeg.",
      );
    }
  })();

const { products } = JSON.parse(
  readFileSync(join(root, "src/lib/marketplace-catalog.json"), "utf8"),
);
const painters = readFileSync(join(here, "material-photo-painters.js"), "utf8");

// Playwright ships CommonJS; a path-based import lands the whole module on
// `default`, while a bare "playwright" specifier is already interop-unwrapped.
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const { chromium } = playwright.default ?? playwright;

mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({
  viewport: { width: WIDTH_2X, height: HEIGHT_2X },
});
await page.addScriptTag({ content: painters });

const missing = await page.evaluate(
  ([kinds]) => kinds.filter((k) => !window.__paintKinds.includes(k)),
  [[...new Set(products.map((p) => p.photo.kind))]],
);
if (missing.length) {
  throw new Error(`Нет painter для: ${missing.join(", ")}`);
}

for (const product of products) {
  const png = join(tmpDir, `${product.id}.png`);

  const dataUrl = await page.evaluate(
    async ([kind, tint, w, h]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      window.__paintMaterial(canvas, kind, tint);
      return canvas.toDataURL("image/png");
    },
    [product.photo.kind, product.photo.tint, WIDTH_2X, HEIGHT_2X],
  );

  writeFileSync(png, Buffer.from(dataUrl.split(",")[1], "base64"));

  const encode = (args) =>
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", png, ...args], {
      stdio: "inherit",
    });

  // Lanczos for the 1x downsample: bilinear softens material detail exactly
  // where these photographs carry their information.
  const half = `scale=${WIDTH_2X / 2}:${HEIGHT_2X / 2}:flags=lanczos`;

  encode(["-c:v", "libwebp", "-quality", "76", "-compression_level", "6", join(outDir, `${product.id}@2x.webp`)]);
  encode(["-vf", half, "-c:v", "libwebp", "-quality", "78", "-compression_level", "6", join(outDir, `${product.id}.webp`)]);
  encode(["-q:v", "5", join(outDir, `${product.id}@2x.jpg`)]);
  encode(["-vf", half, "-q:v", "4", join(outDir, `${product.id}.jpg`)]);

  console.log(`✓ ${product.id} (${product.photo.kind})`);
}

await browser.close();
rmSync(tmpDir, { recursive: true, force: true });
console.log(`\n${products.length} материалов → ${outDir}`);
