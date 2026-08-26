"use client";

import { useMemo } from "react";
import * as THREE from "three";
import {
  GRID_CELL_M,
  GRID_MAJOR_EVERY,
  getBlueprintGridTexture,
} from "@/lib/3d/blueprint-grid";

/**
 * The sheet the house stands on, and nothing else.
 *
 * There is deliberately no desk, no rule and no pencil here. Modelled props
 * competed with the building for attention and never held up next to it; the
 * user's house is the only object in the scene.
 *
 * The plane fades to fully transparent at its rim rather than ending on a hard
 * disc edge, and the canvas behind it is transparent too — so what surrounds
 * the grid is the page's own blueprint layers, and there is no seam where the
 * canvas starts.
 */

/** Large enough that the fade, not the edge, is what the reader ever sees. */
const GROUND_M = 120;

export function BlueprintGround() {
  const grid = getBlueprintGridTexture();

  const material = useMemo(() => {
    const texture = grid.clone();
    texture.needsUpdate = true;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    const repeat = GROUND_M / (GRID_CELL_M * GRID_MAJOR_EVERY);
    texture.repeat.set(repeat, repeat);

    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    // Radial falloff, injected rather than layered as a second mesh: the grid
    // dissolves into the page instead of ending at a visible rim.
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vGroundUv;")
        .replace(
          "#include <uv_vertex>",
          "#include <uv_vertex>\nvGroundUv = uv;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vGroundUv;")
        .replace(
          "#include <opaque_fragment>",
          `float d = distance(vGroundUv, vec2(0.5));
           gl_FragColor.a *= 1.0 - smoothstep(0.16, 0.46, d);
           #include <opaque_fragment>`,
        );
    };
    return mat;
  }, [grid]);

  return (
    <mesh
      // Scenery must never swallow a click meant for the building.
      raycast={() => null}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      material={material}
    >
      <planeGeometry args={[GROUND_M, GROUND_M]} />
    </mesh>
  );
}
