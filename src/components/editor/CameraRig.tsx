"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { roofDimensions } from "@/lib/3d/roof-geometry";
import type { SceneModel } from "@/lib/3d/types";

/**
 * Re-frames the view when the building's height changes. A three-storey
 * house is half again as tall as a two-storey one, and a camera placed for
 * the shorter house cuts the taller one off at the knees.
 *
 * Deliberately keyed on height alone: re-framing on every material change
 * would yank the view out from under someone comparing finishes.
 */
export function CameraRig({ model }: { model: SceneModel }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as
    | { target: { set: (x: number, y: number, z: number) => void }; update: () => void }
    | null;

  const { widthM, depthM, heightM } = model.dimensions;
  const roof = model.nodes.find((n) => n.roof)?.roof;
  const rise = roof
    ? roofDimensions(widthM, depthM, roof.overhangM, roof.pitchDeg, roof.shape)
        .rise
    : 0;
  const totalHeight = heightM + rise;

  useEffect(() => {
    const span = Math.max(widthM, depthM, totalHeight);
    const distance = span * 1.55;
    camera.position.set(distance, totalHeight * 0.6 + distance * 0.42, distance);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(0, totalHeight * 0.42, 0);
      controls.update();
    }
    // Only height drives re-framing; see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalHeight, camera, controls]);

  return null;
}
