/* Offline painters for material sample photography.
 *
 * These are NOT the runtime textures in src/lib/3d/textures.ts. Those are
 * small seamless tiles whose only job is to repeat believably across a 3D
 * surface at any colour. These paint one large still of a material sample as
 * it would be photographed for a catalogue: lit from one side, in focus at
 * the top and falling off at the bottom, with real surface tooth.
 *
 * Runs inside a headless browser via tools/generate-material-photos.mjs.
 * The output is committed as WebP + JPEG; this file is only re-run when a
 * material is added or its look changes.
 */

/* global window, document */
(() => {
  // ---------------------------------------------------------------- colour

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(r, g, b) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return `#${((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1)}`;
  }

  /** Lighten (amount > 0) or darken a colour, in linear-ish RGB steps. */
  function shade(hex, amount) {
    const [r, g, b] = hexToRgb(hex);
    if (amount >= 0) {
      return rgbToHex(
        r + (255 - r) * amount,
        g + (255 - g) * amount,
        b + (255 - b) * amount,
      );
    }
    const k = 1 + amount;
    return rgbToHex(r * k, g * k, b * k);
  }

  function rgba(hex, alpha) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /** Deterministic PRNG — the same material always photographs the same. */
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ------------------------------------------------------------- surface

  /** Fine monochrome tooth, drawn once and reused at several scales. */
  function noiseCanvas(size, seed) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(size, size);
    const r = rng(seed);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + r() * 90;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /** Multi-octave grain: coarse blotches under fine tooth. */
  function grain(ctx, W, H, strength, seed) {
    const fine = noiseCanvas(220, seed);
    const coarse = noiseCanvas(64, seed + 991);
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = strength;
    for (let y = 0; y < H; y += 220) {
      for (let x = 0; x < W; x += 220) ctx.drawImage(fine, x, y);
    }
    ctx.globalAlpha = strength * 0.7;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(coarse, 0, 0, W, H);
    ctx.restore();
  }

  /**
   * One key light from the upper left, ambient falloff to the lower right,
   * and a vignette. This is most of what separates a photograph from a
   * pattern swatch: a flat tile has no light in it at all.
   */
  function lighting(ctx, W, H) {
    ctx.save();

    const key = ctx.createRadialGradient(W * 0.24, -H * 0.15, 0, W * 0.3, 0, H * 1.5);
    key.addColorStop(0, "rgba(255,248,232,0.30)");
    key.addColorStop(0.42, "rgba(255,244,222,0.08)");
    key.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = key;
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = "source-over";
    const fall = ctx.createLinearGradient(0, 0, W * 0.35, H);
    fall.addColorStop(0, "rgba(0,0,0,0)");
    fall.addColorStop(0.55, "rgba(0,0,0,0.10)");
    fall.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = fall;
    ctx.fillRect(0, 0, W, H);

    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.95);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.34)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();
  }

  /**
   * Shallow depth of field: the far edge of the sample softens, the way a
   * close catalogue shot does. Costs one composited copy of the bottom band.
   */
  function defocus(ctx, canvas, W, H) {
    const band = Math.round(H * 0.3);
    const copy = document.createElement("canvas");
    copy.width = W;
    copy.height = band;
    const cctx = copy.getContext("2d");
    cctx.drawImage(canvas, 0, H - band, W, band, 0, 0, W, band);

    ctx.save();
    ctx.filter = "blur(4px)";
    const mask = document.createElement("canvas");
    mask.width = W;
    mask.height = band;
    const mctx = mask.getContext("2d");
    mctx.drawImage(copy, 0, 0);
    mctx.globalCompositeOperation = "destination-in";
    const g = mctx.createLinearGradient(0, 0, 0, band);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,1)");
    mctx.fillStyle = g;
    mctx.fillRect(0, 0, W, band);
    ctx.drawImage(mask, 0, H - band);
    ctx.restore();
  }

  // ------------------------------------------------------------- painters

  function brickCourse(ctx, tint, opts) {
    const { W, H, bw, bh, joint, jitter, chamfer, speckle, seed } = opts;
    const r = rng(seed);

    ctx.fillStyle = shade(tint, -0.55);
    ctx.fillRect(0, 0, W, H);
    // Mortar is never flat grey — it is sanded, and it catches its own light.
    grain(ctx, W, H, 0.4, seed + 3);

    const rows = Math.ceil(H / (bh + joint)) + 1;
    const cols = Math.ceil(W / (bw + joint)) + 2;

    for (let row = 0; row < rows; row++) {
      const y = row * (bh + joint);
      const offset = row % 2 === 0 ? 0 : -(bw + joint) / 2;
      for (let col = -1; col < cols; col++) {
        const x = col * (bw + joint) + offset;
        const face = shade(tint, (r() - 0.45) * jitter);

        ctx.fillStyle = face;
        ctx.fillRect(x, y, bw, bh);

        // Fired clay is blotchy across a single brick, not one flat colour.
        for (let i = 0; i < speckle; i++) {
          const sx = x + r() * bw;
          const sy = y + r() * bh;
          const rad = 2 + r() * (bh * 0.28);
          ctx.fillStyle = rgba(shade(face, r() > 0.5 ? 0.16 : -0.2), 0.16 + r() * 0.2);
          ctx.beginPath();
          ctx.ellipse(sx, sy, rad, rad * (0.5 + r() * 0.6), r() * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Arris: lit along the top and left, shadowed opposite.
        ctx.fillStyle = rgba(shade(face, 0.34), 0.75);
        ctx.fillRect(x, y, bw, chamfer);
        ctx.fillRect(x, y, chamfer, bh);
        ctx.fillStyle = "rgba(0,0,0,0.34)";
        ctx.fillRect(x, y + bh - chamfer, bw, chamfer);
        ctx.fillRect(x + bw - chamfer, y, chamfer, bh);

        // The joint sits back from the face, so the brick casts into it.
        ctx.fillStyle = "rgba(0,0,0,0.30)";
        ctx.fillRect(x, y + bh, bw + joint, joint * 0.55);
      }
    }
  }

  const PAINTERS = {
    brick(ctx, tint, W, H) {
      brickCourse(ctx, tint, {
        W, H,
        bw: W * 0.29, bh: H * 0.115, joint: H * 0.028,
        jitter: 0.22, chamfer: 3, speckle: 14, seed: 11,
      });
    },

    "brick-clinker"(ctx, tint, W, H) {
      brickCourse(ctx, tint, {
        W, H,
        bw: W * 0.33, bh: H * 0.086, joint: H * 0.022,
        jitter: 0.3, chamfer: 2, speckle: 20, seed: 23,
      });
      // Sintered clinker is faintly glazed: a long, low specular streak.
      const g = ctx.createLinearGradient(0, 0, W, H * 0.7);
      g.addColorStop(0, "rgba(255,246,228,0.16)");
      g.addColorStop(0.45, "rgba(255,246,228,0.03)");
      g.addColorStop(1, "rgba(255,246,228,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },

    "ceramic-wave"(ctx, tint, W, H) {
      ctx.fillStyle = shade(tint, -0.5);
      ctx.fillRect(0, 0, W, H);
      const r = rng(31);
      const rowH = H * 0.235;
      const waveW = W * 0.27;

      for (let row = -1; row * rowH < H + rowH; row++) {
        const y = row * rowH;
        const stagger = row % 2 === 0 ? 0 : waveW / 2;
        for (let x = -waveW; x < W + waveW; x += waveW) {
          const x0 = x + stagger;
          const face = shade(tint, (r() - 0.5) * 0.16);

          // One pantile: a trough rolling up into a crest.
          const g = ctx.createLinearGradient(x0, 0, x0 + waveW, 0);
          g.addColorStop(0, shade(face, -0.42));
          g.addColorStop(0.28, shade(face, -0.1));
          g.addColorStop(0.55, shade(face, 0.26));
          g.addColorStop(0.72, shade(face, 0.05));
          g.addColorStop(1, shade(face, -0.46));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x0 + waveW, y);
          ctx.lineTo(x0 + waveW, y + rowH * 1.06);
          ctx.quadraticCurveTo(
            x0 + waveW / 2, y + rowH * 1.22,
            x0, y + rowH * 1.06,
          );
          ctx.closePath();
          ctx.fill();

          // The course above overhangs and drops a shadow onto this one.
          const sh = ctx.createLinearGradient(0, y, 0, y + rowH * 0.34);
          sh.addColorStop(0, "rgba(0,0,0,0.5)");
          sh.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = sh;
          ctx.fillRect(x0, y, waveW, rowH * 0.34);
        }
      }
      grain(ctx, W, H, 0.32, 77);
    },

    "metal-tile"(ctx, tint, W, H) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);

      // The sheet is rolled into a continuous wave across its width. Shading
      // it as a run of gradient-filled boxes puts a dark edge on both sides of
      // every pan and the result reads as quilting, so the wave is integrated
      // column by column instead: one smooth cycle, one specular crest.
      const wave = W * 0.21;
      for (let x = 0; x < W; x += 2) {
        const phase = ((x % wave) / wave) * Math.PI * 2;
        const facing = Math.cos(phase);
        ctx.fillStyle =
          facing >= 0
            ? `rgba(255,255,255,${(facing ** 1.6) * 0.2})`
            : `rgba(0,0,0,${(Math.abs(facing) ** 1.4) * 0.3})`;
        ctx.fillRect(x, 0, 3, H);
      }

      // Courses: each step is a flat pan that breaks down to the next one.
      // Only the break carries a hard line — the pan itself stays flat, the
      // way pressed steel does.
      const step = H * 0.27;
      for (let y = -step; y < H + step; y += step) {
        const g = ctx.createLinearGradient(0, y, 0, y + step);
        g.addColorStop(0, "rgba(255,255,255,0.1)");
        g.addColorStop(0.16, "rgba(255,255,255,0.02)");
        g.addColorStop(0.7, "rgba(0,0,0,0.03)");
        g.addColorStop(0.94, "rgba(0,0,0,0.2)");
        g.addColorStop(1, "rgba(0,0,0,0.52)");
        ctx.fillStyle = g;
        ctx.fillRect(0, y, W, step);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, y + step - 4, W, 4);
        ctx.fillStyle = "rgba(255,255,255,0.24)";
        ctx.fillRect(0, y + step, W, 3);
      }

      // Polyester coating is matte but not dead: a wide, soft specular.
      const spec = ctx.createLinearGradient(0, 0, W * 0.8, H);
      spec.addColorStop(0, "rgba(255,255,255,0.16)");
      spec.addColorStop(0.5, "rgba(255,255,255,0.02)");
      spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = spec;
      ctx.fillRect(0, 0, W, H);
      grain(ctx, W, H, 0.16, 41);
    },

    seam(ctx, tint, W, H) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      const panel = W * 0.26;
      for (let x = 0; x < W + panel; x += panel) {
        const g = ctx.createLinearGradient(x, 0, x + panel, 0);
        g.addColorStop(0, shade(tint, -0.2));
        g.addColorStop(0.34, shade(tint, 0.12));
        g.addColorStop(0.7, shade(tint, -0.04));
        g.addColorStop(1, shade(tint, -0.26));
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, panel, H);

        // The standing seam itself: a folded rib with its own highlight.
        const w = panel * 0.055;
        const rib = ctx.createLinearGradient(x - w, 0, x + w, 0);
        rib.addColorStop(0, shade(tint, -0.44));
        rib.addColorStop(0.42, shade(tint, 0.42));
        rib.addColorStop(0.6, shade(tint, 0.1));
        rib.addColorStop(1, shade(tint, -0.5));
        ctx.fillStyle = rib;
        ctx.fillRect(x - w, 0, w * 2, H);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(x + w, 0, w * 1.6, H);
      }
      const spec = ctx.createLinearGradient(0, H, W, 0);
      spec.addColorStop(0, "rgba(255,255,255,0)");
      spec.addColorStop(0.6, "rgba(255,255,255,0.12)");
      spec.addColorStop(1, "rgba(255,255,255,0.3)");
      ctx.fillStyle = spec;
      ctx.fillRect(0, 0, W, H);
      grain(ctx, W, H, 0.14, 53);
    },

    profnastil(ctx, tint, W, H) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      const pitch = W * 0.2;
      for (let x = 0; x < W + pitch; x += pitch) {
        // Trapezoid: flat pan, sloped web, flat crest.
        const g = ctx.createLinearGradient(x, 0, x + pitch, 0);
        g.addColorStop(0, shade(tint, -0.3));
        g.addColorStop(0.2, shade(tint, -0.14));
        g.addColorStop(0.42, shade(tint, 0.3));
        g.addColorStop(0.58, shade(tint, 0.34));
        g.addColorStop(0.78, shade(tint, -0.12));
        g.addColorStop(1, shade(tint, -0.32));
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, pitch, H);
      }
      // Galvanised spangle: crystals across the zinc coating.
      const r = rng(67);
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      for (let i = 0; i < 320; i++) {
        const cx = r() * W;
        const cy = r() * H;
        const rad = 6 + r() * 26;
        ctx.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.12})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rad, rad * (0.4 + r() * 0.5), r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      grain(ctx, W, H, 0.2, 67);
    },

    shingle(ctx, tint, W, H) {
      ctx.fillStyle = shade(tint, -0.45);
      ctx.fillRect(0, 0, W, H);
      const r = rng(13);
      const courseH = H * 0.2;
      const tabW = W * 0.19;

      for (let row = -1; row * courseH < H + courseH; row++) {
        const y = row * courseH;
        const stagger = row % 2 === 0 ? 0 : tabW / 2;
        for (let x = -tabW; x < W + tabW; x += tabW) {
          const x0 = x + stagger;
          ctx.fillStyle = shade(tint, (r() - 0.4) * 0.26);
          ctx.fillRect(x0, y, tabW - 3, courseH * 1.08);
          // Cut between tabs, and the course above shadowing this one.
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(x0 + tabW - 3, y, 3, courseH * 1.08);
        }
        const sh = ctx.createLinearGradient(0, y, 0, y + courseH * 0.3);
        sh.addColorStop(0, "rgba(0,0,0,0.45)");
        sh.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sh;
        ctx.fillRect(0, y, W, courseH * 0.3);
      }

      // Basalt granulate — the thing that actually identifies this material.
      for (let i = 0; i < 26000; i++) {
        const gx = r() * W;
        const gy = r() * H;
        const t = r();
        const c =
          t > 0.82 ? shade(tint, 0.42) : t > 0.55 ? shade(tint, 0.16) : shade(tint, -0.3);
        ctx.fillStyle = rgba(c, 0.5 + r() * 0.4);
        ctx.fillRect(gx, gy, 2 + r() * 2.4, 2 + r() * 2.4);
      }
    },

    plaster(ctx, tint, W, H) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      const r = rng(19);
      // "Короед": the grain is dragged by the float, ploughing grooves.
      for (let i = 0; i < 1500; i++) {
        const x = r() * W;
        const y = r() * H;
        const len = 22 + r() * 78;
        const angle = (r() - 0.5) * 0.6 + (r() > 0.62 ? Math.PI / 2 : 0);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.lineCap = "round";
        ctx.strokeStyle = rgba(shade(tint, -0.32), 0.1 + r() * 0.16);
        ctx.lineWidth = 3 + r() * 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(len * 0.5, (r() - 0.5) * 8, len, 0);
        ctx.stroke();
        // Every groove has a lit lip on the side facing the light.
        ctx.strokeStyle = rgba(shade(tint, 0.5), 0.16);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -3.5);
        ctx.quadraticCurveTo(len * 0.5, (r() - 0.5) * 8 - 3.5, len, -3.5);
        ctx.stroke();
        ctx.restore();
      }
      grain(ctx, W, H, 0.5, 19);
    },

    siding(ctx, tint, W, H) {
      ctx.fillStyle = shade(tint, -0.3);
      ctx.fillRect(0, 0, W, H);
      const rowH = H * 0.34;
      for (let y = -rowH; y < H + rowH; y += rowH) {
        // Block-house profile: each board is a half-log, so it shades as a
        // cylinder rather than as a flat plank.
        const g = ctx.createLinearGradient(0, y, 0, y + rowH);
        g.addColorStop(0, shade(tint, -0.34));
        g.addColorStop(0.14, shade(tint, 0.06));
        g.addColorStop(0.42, shade(tint, 0.3));
        g.addColorStop(0.72, shade(tint, -0.02));
        g.addColorStop(0.9, shade(tint, -0.4));
        g.addColorStop(1, shade(tint, -0.62));
        ctx.fillStyle = g;
        ctx.fillRect(0, y, W, rowH);

        // Where one panel laps the next there is a real shadow gap, and the
        // lit edge of the board below it. Without those the profile dissolves
        // into a soft band and stops reading as siding at all.
        ctx.fillStyle = "rgba(0,0,0,0.62)";
        ctx.fillRect(0, y + rowH - rowH * 0.05, W, rowH * 0.05);
        ctx.fillStyle = rgba(shade(tint, 0.45), 0.75);
        ctx.fillRect(0, y + rowH, W, rowH * 0.018);
      }
      // Embossed wood print on the vinyl.
      const r = rng(83);
      for (let i = 0; i < 420; i++) {
        const y = r() * H;
        ctx.strokeStyle = rgba(shade(tint, r() > 0.5 ? -0.34 : 0.28), 0.3);
        ctx.lineWidth = 1 + r() * 3;
        ctx.beginPath();
        ctx.moveTo(-10, y);
        ctx.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 10, W * 0.7, y + (r() - 0.5) * 10, W + 10, y);
        ctx.stroke();
      }
      grain(ctx, W, H, 0.22, 83);
    },

    planken(ctx, tint, W, H) {
      const boardH = H * 0.27;
      const r = rng(29);
      for (let y = -boardH; y < H + boardH; y += boardH) {
        const base = shade(tint, (r() - 0.5) * 0.12);
        ctx.fillStyle = base;
        ctx.fillRect(0, y, W, boardH);

        // Grain: long fibres, tighter near the board edges.
        for (let i = 0; i < 90; i++) {
          const gy = y + r() * boardH;
          const edge = Math.abs(gy - (y + boardH / 2)) / (boardH / 2);
          ctx.strokeStyle = rgba(shade(base, r() > 0.6 ? 0.22 : -0.26), 0.1 + edge * 0.3);
          ctx.lineWidth = 0.8 + r() * 2.4;
          ctx.beginPath();
          ctx.moveTo(-20, gy);
          ctx.bezierCurveTo(
            W * 0.35, gy + (r() - 0.5) * 14,
            W * 0.7, gy + (r() - 0.5) * 14,
            W + 20, gy,
          );
          ctx.stroke();
        }
        // A knot, sometimes — larch is graded AB, not clear.
        if (r() > 0.45) {
          const kx = r() * W;
          const ky = y + boardH * (0.3 + r() * 0.4);
          const kr = boardH * (0.08 + r() * 0.07);
          for (let i = 5; i > 0; i--) {
            ctx.strokeStyle = rgba(shade(base, -0.34), 0.5);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(kx, ky, kr * (i / 5), kr * 0.7 * (i / 5), 0.4, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = rgba(shade(base, -0.5), 0.75);
          ctx.beginPath();
          ctx.ellipse(kx, ky, kr * 0.34, kr * 0.24, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        // The bevel between boards: shadow below, lit lip above.
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, y + boardH - 6, W, 6);
        ctx.fillStyle = rgba(shade(base, 0.3), 0.5);
        ctx.fillRect(0, y + boardH, W, 3);
      }
      grain(ctx, W, H, 0.26, 29);
    },

    "mineral-wool"(ctx, tint, W, H) {
      ctx.fillStyle = shade(tint, -0.28);
      ctx.fillRect(0, 0, W, H);
      const r = rng(37);

      // Wool is fibre over fibre with air between. Evenly angled strands of
      // one weight read as brushed metal instead, so the strands here vary
      // widely in thickness and tone, wander, and gather into clumps with
      // dark voids between them.
      for (let c = 0; c < 46; c++) {
        const cx = r() * W;
        const cy = r() * H;
        const spread = 40 + r() * 150;
        const bias = r() * Math.PI;
        for (let i = 0; i < 130; i++) {
          const x = cx + (r() - 0.5) * spread * 2;
          const y = cy + (r() - 0.5) * spread;
          const len = 20 + r() * 170;
          const angle = bias + (r() - 0.5) * 1.5;
          const bright = r();
          ctx.strokeStyle = rgba(
            shade(tint, bright > 0.72 ? 0.3 + r() * 0.25 : (r() - 0.62) * 0.7),
            0.16 + r() * 0.5,
          );
          ctx.lineWidth = bright > 0.9 ? 3 + r() * 4 : 0.6 + r() * 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.bezierCurveTo(
            x + Math.cos(angle) * len * 0.3, y + Math.sin(angle) * len * 0.3 + (r() - 0.5) * 40,
            x + Math.cos(angle) * len * 0.7, y + Math.sin(angle) * len * 0.7 - (r() - 0.5) * 40,
            x + Math.cos(angle) * len, y + Math.sin(angle) * len,
          );
          ctx.stroke();
        }
      }

      // Voids: the gaps between clumps go dark, which is what gives wool its
      // depth rather than a uniform mat.
      for (let i = 0; i < 60; i++) {
        const cx = r() * W;
        const cy = r() * H;
        const rad = 20 + r() * 90;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, `rgba(0,0,0,${0.18 + r() * 0.3})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      // Air between the fibres reads as depth, not as black.
      const g = ctx.createRadialGradient(W * 0.4, H * 0.35, 0, W * 0.5, H * 0.5, H);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.3)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      grain(ctx, W, H, 0.3, 37);
    },

    xps(ctx, tint, W, H) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      const r = rng(43);
      // Closed cells: a dense field of shallow pits, all about one size.
      for (let i = 0; i < 5200; i++) {
        const x = r() * W;
        const y = r() * H;
        const rad = 5 + r() * 9;
        ctx.strokeStyle = rgba(shade(tint, -0.38), 0.24 + r() * 0.24);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = rgba(shade(tint, -0.24), 0.1 + r() * 0.12);
        ctx.beginPath();
        ctx.arc(x, y, rad * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba(shade(tint, 0.42), 0.22);
        ctx.beginPath();
        ctx.arc(x - rad * 0.3, y - rad * 0.34, rad * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
      // The milled L-edge of the board, along the bottom.
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, H * 0.84, W, 4);
      const lip = ctx.createLinearGradient(0, H * 0.84, 0, H);
      lip.addColorStop(0, shade(tint, 0.14));
      lip.addColorStop(1, shade(tint, -0.3));
      ctx.fillStyle = lip;
      ctx.fillRect(0, H * 0.845, W, H * 0.155);
      grain(ctx, W, H, 0.24, 43);
    },

    membrane(ctx, tint, W, H) {
      const dark = hexToRgb(tint)[0] < 120;
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      const r = rng(59);

      if (dark) {
        // Bitumen with slate dressing: coarse mineral grit.
        for (let i = 0; i < 24000; i++) {
          const x = r() * W;
          const y = r() * H;
          ctx.fillStyle = rgba(shade(tint, r() > 0.7 ? 0.4 : 0.14), 0.3 + r() * 0.5);
          ctx.fillRect(x, y, 2 + r() * 3, 2 + r() * 3);
        }
      } else {
        // Spunbond: a woven grid. At 9 px the weave vanished in the 1x
        // downsample, so the pitch is wide enough to survive resampling and
        // the threads carry real light and shade.
        // Fibre mat under the reinforcing grid — without it the threads read
        // as ruled lines on paper rather than as a laminated fabric.
        for (let i = 0; i < 5000; i++) {
          const x = r() * W;
          const y = r() * H;
          const len = 8 + r() * 46;
          const a = r() * Math.PI;
          ctx.strokeStyle = rgba(shade(tint, (r() - 0.5) * 0.5), 0.1 + r() * 0.2);
          ctx.lineWidth = 0.8 + r() * 1.6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
          ctx.stroke();
        }

        const pitch = 26;
        for (let x = 0; x < W + pitch; x += pitch) {
          const j = (r() - 0.5) * 7;
          ctx.strokeStyle = rgba(shade(tint, -0.4), 0.45);
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(x + j, 0);
          ctx.lineTo(x + j, H);
          ctx.stroke();
          ctx.strokeStyle = rgba(shade(tint, 0.5), 0.6);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + j - 1.4, 0);
          ctx.lineTo(x + j - 1.4, H);
          ctx.stroke();
        }
        for (let y = 0; y < H + pitch; y += pitch) {
          const j = (r() - 0.5) * 7;
          ctx.strokeStyle = rgba(shade(tint, -0.34), 0.4);
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(0, y + j);
          ctx.lineTo(W, y + j);
          ctx.stroke();
          ctx.strokeStyle = rgba(shade(tint, 0.45), 0.5);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, y + j - 1.4);
          ctx.lineTo(W, y + j - 1.4);
          ctx.stroke();
        }
      }

      // The roll: the sheet curves away at the top edge.
      const roll = ctx.createLinearGradient(0, 0, 0, H * 0.16);
      roll.addColorStop(0, "rgba(0,0,0,0.34)");
      roll.addColorStop(0.6, "rgba(255,255,255,0.07)");
      roll.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = roll;
      ctx.fillRect(0, 0, W, H * 0.16);
      grain(ctx, W, H, 0.3, 59);
    },

    mortar(ctx, tint, W, H) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      const r = rng(71);
      // A poured heap of dry mix: sand grade, with a few coarser grains.
      for (let i = 0; i < 34000; i++) {
        const x = r() * W;
        const y = r() * H;
        // Fine sand disappears entirely once the photo is resampled to 1x,
        // leaving a smooth grey wall. These grains are sized to survive it.
        const s = r() > 0.97 ? 6 + r() * 7 : 2.6 + r() * 3.4;
        ctx.fillStyle = rgba(
          shade(tint, (r() - 0.5) * 0.8),
          0.34 + r() * 0.55,
        );
        ctx.fillRect(x, y, s, s);
      }
      // Loose material has soft relief, but drawing it as a handful of
      // radial gradients leaves visible rings where they overlap. A very
      // low-frequency noise field blown up and blurred gives the same
      // undulation with no edges in it.
      const relief = noiseCanvas(24, 733);
      ctx.save();
      ctx.filter = "blur(26px)";
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.4;
      ctx.drawImage(relief, -40, -40, W + 80, H + 80);
      ctx.restore();
      grain(ctx, W, H, 0.4, 71);
    },

    concrete(ctx, tint, W, H) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      const r = rng(89);
      // Aggregate showing through the laitance.
      for (let i = 0; i < 2600; i++) {
        const x = r() * W;
        const y = r() * H;
        const rad = 3 + r() * 16;
        ctx.fillStyle = rgba(shade(tint, (r() - 0.5) * 0.5), 0.2 + r() * 0.3);
        ctx.beginPath();
        ctx.ellipse(x, y, rad, rad * (0.6 + r() * 0.5), r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // Air voids left against the formwork.
      for (let i = 0; i < 260; i++) {
        const x = r() * W;
        const y = r() * H;
        const rad = 2 + r() * 7;
        ctx.fillStyle = "rgba(0,0,0,0.34)";
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba(shade(tint, 0.3), 0.3);
        ctx.beginPath();
        ctx.arc(x - rad * 0.2, y - rad * 0.35, rad * 0.7, Math.PI, Math.PI * 2);
        ctx.fill();
      }
      // Form joint across the face.
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(0, H * 0.62, W, 5);
      ctx.fillStyle = rgba(shade(tint, 0.24), 0.4);
      ctx.fillRect(0, H * 0.62 + 5, W, 2);
      grain(ctx, W, H, 0.42, 89);
    },

    shtaketnik(ctx, tint, W, H) {
      // Gaps show the ground behind the fence, not a flat backing.
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0c0b0a");
      bg.addColorStop(1, "#141210");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const r = rng(97);
      const pitch = W * 0.155;
      const slat = pitch * 0.66;
      for (let x = -pitch; x < W + pitch; x += pitch) {
        // M-profile: two folds, so the face is split by a central ridge.
        const g = ctx.createLinearGradient(x, 0, x + slat, 0);
        g.addColorStop(0, shade(tint, -0.4));
        g.addColorStop(0.16, shade(tint, 0.06));
        g.addColorStop(0.44, shade(tint, 0.24));
        g.addColorStop(0.5, shade(tint, -0.06));
        g.addColorStop(0.56, shade(tint, 0.22));
        g.addColorStop(0.86, shade(tint, -0.04));
        g.addColorStop(1, shade(tint, -0.44));
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, slat, H);

        // Wood print rolled onto the steel.
        for (let i = 0; i < 26; i++) {
          const gy = r() * H;
          ctx.strokeStyle = rgba(shade(tint, r() > 0.5 ? -0.3 : 0.2), 0.22);
          ctx.lineWidth = 0.8 + r() * 2;
          ctx.beginPath();
          ctx.moveTo(x, gy);
          ctx.bezierCurveTo(x + slat * 0.4, gy + (r() - 0.5) * 30, x + slat * 0.7, gy + (r() - 0.5) * 30, x + slat, gy);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x + slat, 0, pitch - slat, H);
      }
      grain(ctx, W, H, 0.2, 97);
    },

    forged(ctx, tint, W, H) {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0b0b0a");
      bg.addColorStop(1, "#15140f");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const bar = (x0, y0, x1, y1, w) => {
        const ang = Math.atan2(y1 - y0, x1 - x0);
        ctx.save();
        ctx.translate(x0, y0);
        ctx.rotate(ang);
        const len = Math.hypot(x1 - x0, y1 - y0);
        // Round section: bright along the top of the bar, dark underneath.
        const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
        g.addColorStop(0, shade(tint, -0.3));
        g.addColorStop(0.3, shade(tint, 0.5));
        g.addColorStop(0.55, shade(tint, 0.1));
        g.addColorStop(1, shade(tint, -0.5));
        ctx.fillStyle = g;
        ctx.fillRect(0, -w / 2, len, w);
        ctx.restore();
      };

      const pitch = W * 0.22;
      for (let x = pitch * 0.5; x < W + pitch; x += pitch) bar(x, -20, x, H + 20, 16);
      bar(-20, H * 0.2, W + 20, H * 0.2, 20);
      bar(-20, H * 0.82, W + 20, H * 0.82, 20);

      // Forged scrolls between the uprights.
      const r = rng(101);
      for (let x = pitch; x < W; x += pitch) {
        ctx.strokeStyle = shade(tint, 0.3);
        ctx.lineWidth = 11;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(x, H * 0.5, H * 0.14, 0.4, 4.4);
        ctx.stroke();
        ctx.strokeStyle = shade(tint, -0.35);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, H * 0.5 + 3, H * 0.14, 0.6, 4.2);
        ctx.stroke();
      }
      // Hammer scale on the powder coat.
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = `rgba(255,255,255,${r() * 0.18})`;
        ctx.fillRect(r() * W, r() * H, 2 + r() * 4, 2 + r() * 4);
      }
      ctx.restore();
    },

    glass(ctx, tint, W, H) {
      // A glazing unit reflects the sky, so the "colour" of glass is a
      // gradient of what is in front of it, not a fill.
      const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
      g.addColorStop(0, shade(tint, 0.42));
      g.addColorStop(0.35, shade(tint, 0.1));
      g.addColorStop(0.7, shade(tint, -0.3));
      g.addColorStop(1, shade(tint, -0.55));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Cloud banding in the reflection.
      const r = rng(103);
      for (let i = 0; i < 22; i++) {
        const y = r() * H;
        const h = 12 + r() * 90;
        const cg = ctx.createLinearGradient(0, y, 0, y + h);
        cg.addColorStop(0, "rgba(255,255,255,0)");
        cg.addColorStop(0.5, `rgba(255,255,255,${0.04 + r() * 0.1})`);
        cg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = cg;
        ctx.fillRect(0, y, W, h);
      }

      // The white frame, and the shadow the sash casts on the glass.
      const frame = W * 0.075;
      ctx.fillStyle = "#E8E6E1";
      ctx.fillRect(0, 0, W, frame);
      ctx.fillRect(0, H - frame, W, frame);
      ctx.fillRect(0, 0, frame, H);
      ctx.fillRect(W - frame, 0, frame, H);
      ctx.fillStyle = "#D5D2CB";
      ctx.fillRect(0, frame - 6, W, 6);
      ctx.fillRect(frame - 6, 0, 6, H);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(frame, frame, W - frame * 2, 10);
      ctx.fillRect(frame, frame, 10, H - frame * 2);

      // Long specular sweep across the pane.
      const spec = ctx.createLinearGradient(W * 0.1, 0, W * 0.75, H);
      spec.addColorStop(0, "rgba(255,255,255,0)");
      spec.addColorStop(0.46, "rgba(255,255,255,0.2)");
      spec.addColorStop(0.52, "rgba(255,255,255,0.06)");
      spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = spec;
      ctx.fillRect(frame, frame, W - frame * 2, H - frame * 2);
    },

    "steel-door"(ctx, tint, W, H) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      // Pressed panels, recessed into the leaf.
      const inset = (x, y, w, h, depth) => {
        ctx.fillStyle = "rgba(0,0,0,0.42)";
        ctx.fillRect(x, y, w, depth);
        ctx.fillRect(x, y, depth, h);
        ctx.fillStyle = rgba(shade(tint, 0.3), 0.6);
        ctx.fillRect(x, y + h - depth, w, depth);
        ctx.fillRect(x + w - depth, y, depth, h);
        const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
        g.addColorStop(0, shade(tint, 0.08));
        g.addColorStop(1, shade(tint, -0.16));
        ctx.fillStyle = g;
        ctx.fillRect(x + depth, y + depth, w - depth * 2, h - depth * 2);
      };
      inset(W * 0.08, H * 0.08, W * 0.84, H * 0.4, 7);
      inset(W * 0.08, H * 0.54, W * 0.84, H * 0.38, 7);

      // Powder coat has orange peel — fine, even, low relief.
      const r = rng(107);
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      for (let i = 0; i < 7000; i++) {
        const x = r() * W;
        const y = r() * H;
        const rad = 3 + r() * 7;
        ctx.fillStyle = `rgba(255,255,255,${r() * 0.1})`;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      grain(ctx, W, H, 0.2, 107);
    },
  };

  window.__paintMaterial = function paintMaterial(canvas, kind, tint) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const painter = PAINTERS[kind];
    if (!painter) throw new Error(`Нет painter для «${kind}»`);
    ctx.save();
    painter(ctx, tint, W, H);
    ctx.restore();
    lighting(ctx, W, H);
    defocus(ctx, canvas, W, H);
  };

  window.__paintKinds = Object.keys(PAINTERS);
})();
