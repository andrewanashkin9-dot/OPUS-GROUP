"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * The soft shadow that seats the house on the paper.
 *
 * Baked into a texture rather than drawn with drei's <ContactShadows>. That
 * helper renders the scene from below into its own framebuffer every frame,
 * which does not compose with `frameloop="demand"` — the canvas draws only
 * when something changed, and the shadow pass ends up producing nothing at
 * all. Verified rather than assumed: with the helper in place, a screenshot of
 * the ground with its opacity at 0.5 and at 0 came back byte-identical.
 *
 * A single object on a flat plane does not need a render pass to be grounded.
 * An elliptical falloff sized to the building's own footprint reads the same,
 * costs one textured quad, and is correct on the first frame.
 */

const TEX_PX = 256;

let cached: THREE.CanvasTexture | null = null;

function shadowTexture(): THREE.CanvasTexture {
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TEX_PX;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const r = TEX_PX / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    // Dense and tight under the walls, gone well before the edge — the falloff
    // of contact occlusion, not a drop shadow.
    g.addColorStop(0, "rgba(3,8,26,0.72)");
    g.addColorStop(0.45, "rgba(3,8,26,0.46)");
    g.addColorStop(0.72, "rgba(3,8,26,0.14)");
    g.addColorStop(1, "rgba(3,8,26,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TEX_PX, TEX_PX);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cached = texture;
  return texture;
}

interface GroundShadowProps {
  widthM: number;
  depthM: number;
}

export function GroundShadow({ widthM, depthM }: GroundShadowProps) {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: shadowTexture(),
        transparent: true,
        depthWrite: false,
        // Multiplicative would crush the ruling underneath to black; normal
        // blending lets the grid stay visible through the shadow, which is
        // what keeps the house sitting *on* the paper rather than in a hole.
        blending: THREE.NormalBlending,
      }),
    [],
  );

  // Spread past the walls by roughly the eaves, so the falloff starts where
  // the building actually meets the ground.
  const w = widthM * 1.55;
  const d = depthM * 1.55;

  return (
    <mesh
      raycast={() => null}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.004, 0]}
      material={material}
      renderOrder={1}
    >
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}
