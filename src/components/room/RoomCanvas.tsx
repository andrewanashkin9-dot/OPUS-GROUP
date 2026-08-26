"use client";

import {
  Environment,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import type { RoomModel, SurfaceId } from "@/lib/room";
import { BlueprintGround } from "@/components/editor/BlueprintGround";
import { RoomScene } from "./RoomScene";

/** Eye height, for the view from inside. */
const EYE_M = 1.6;

interface RoomCanvasProps {
  room: RoomModel;
  selectedSurfaceId: SurfaceId | null;
  insideView: boolean;
  onSelect: (id: SurfaceId) => void;
}

export function RoomCanvas({
  room,
  selectedSurfaceId,
  insideView,
  onSelect,
}: RoomCanvasProps) {
  const { widthM, lengthM, heightM } = room.dimensions;
  const span = Math.max(widthM, lengthM, heightM);
  /**
   * How far the camera may orbit from the middle of the room while staying
   * inside it. Keyed on the SHORTER side, not the diagonal: an orbit radius
   * taken from the diagonal sweeps straight through the long walls, and once
   * the camera is outside one, that wall goes translucent and the reader is
   * looking at their room through a ghost.
   */
  const insideReach = Math.min(widthM, lengthM) * 0.42;

  return (
    <Canvas
      // Transparent, like the house editor: what surrounds the room is the
      // page's own blueprint layers, so there is no seam where the canvas
      // begins.
      gl={{
        alpha: true,
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        // Stopped down. With the environment, a key light and the pendant all
        // adding up, every pale finish clipped to white and the catalogue
        // texture on it stopped being visible at all — the wall tile read as
        // blank plaster. Under-exposing slightly is what keeps the material
        // the reader just chose actually legible.
        toneMappingExposure: 0.78,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      shadows={{ type: THREE.PCFSoftShadowMap }}
      className="!touch-none"
      frameloop="demand"
      dpr={[1, 2]}
    >
      {/* Two focal lengths, because the two views are two different photographs.
          A 40° lens frames the room as an object; standing inside it that same
          lens shows a wall and little else, which is why every interior shot
          ever taken is wide. The near plane is set once and low enough for
          both: at room scale, 5 cm to 2 km still leaves the depth buffer far
          more precision than anything here needs. Declared rather than
          assigned so the projection matrix is rebuilt by the camera itself. */}
      <PerspectiveCamera makeDefault fov={insideView ? 62 : 40} near={0.05} />

      {/* The same in-scene lighting the house editor uses: Poly Haven is
          unreachable from here and drei's HDRI presets pull from a CDN, so
          the environment is assembled from lightformers. Being image-based,
          it also lights the inward faces of the walls, which a key light
          alone would leave black the moment the camera steps inside. */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={1.6}
          color="#eaf1ff"
          position={[0, 8, 6]}
          scale={[14, 8, 1]}
          rotation={[-Math.PI / 6, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.8}
          color="#9fb6e0"
          position={[-9, 5, -6]}
          scale={[10, 6, 1]}
          rotation={[0, Math.PI / 3, 0]}
        />
        {/* The bounce off the floor. It was a cold blue, inherited from the
            house editor where it is light coming off the ground — indoors it
            painted the ceiling the colour of the sheet, and a white stretch
            ceiling rendered navy. */}
        <Lightformer
          form="rect"
          intensity={0.6}
          color="#c9bda8"
          position={[0, -6, 0]}
          scale={[16, 16, 1]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </Environment>

      <directionalLight
        position={[span * 1.4, span * 2.2, span * 1.1]}
        intensity={0.75}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-span * 1.8, span * 1.8, span * 1.8, -span * 1.8, 0.1, span * 6]}
        />
      </directionalLight>
      <ambientLight intensity={0.34} />

      {/* The sheet, and no contact shadow.
          The house editor floats a baked shadow just above the ground because
          the house stands ON the ground. A room's floor IS the ground plane,
          so there is nothing for a contact shadow to be the shadow of — and
          being transparent it sorted over the slab whatever height it was
          given, blotting the middle of the very surface the reader is
          choosing a finish for. */}
      <BlueprintGround />

      <RoomScene
        room={room}
        selectedSurfaceId={selectedSurfaceId}
        onSelect={onSelect}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        // Inside, you turn on the spot and have to be able to get close to a
        // wall; outside, the room is an object you walk around.
        minDistance={insideView ? 0.3 : span * 0.8}
        maxDistance={insideView ? insideReach : span * 4}
        maxPolarAngle={insideView ? Math.PI - 0.2 : Math.PI / 2.05}
        minPolarAngle={insideView ? 0.2 : 0}
      />
      <RoomCameraRig room={room} insideView={insideView} />
    </Canvas>
  );
}

/**
 * Places the camera for the two views, and re-frames when the room changes
 * shape.
 *
 * Keyed on the dimensions and the view, not on the finishes: re-framing every
 * time someone picks a floor would yank the view out from under them
 * mid-comparison.
 */
function RoomCameraRig({
  room,
  insideView,
}: {
  room: RoomModel;
  insideView: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null;

  const { widthM, lengthM, heightM } = room.dimensions;

  useEffect(() => {
    const span = Math.max(widthM, lengthM, heightM);
    if (insideView) {
      // Orbiting around the middle of the room at eye height, which is what
      // "turning on the spot" amounts to with an orbit control. The offset
      // is inside the reach the controls allow, so the first frame does not
      // start out clamped.
      const reach = Math.min(widthM, lengthM) * 0.3;
      camera.position.set(reach, EYE_M, reach);
      controls?.target.set(0, EYE_M * 0.9, 0);
    } else {
      const distance = span * 1.55;
      camera.position.set(distance, heightM + distance * 0.62, distance);
      controls?.target.set(0, heightM * 0.4, 0);
    }
    camera.updateProjectionMatrix();
    controls?.update();
    // Moving the camera imperatively has to request the frame that shows it.
    invalidate();
  }, [widthM, lengthM, heightM, insideView, camera, controls, invalidate]);

  return null;
}
