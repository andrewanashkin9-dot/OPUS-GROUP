"use client";

import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { roofDimensions } from "@/lib/3d/roof-geometry";
import type { SceneModel } from "@/lib/3d/types";
import { BlueprintGround } from "./BlueprintGround";
import { CameraRig } from "./CameraRig";
import { GroundShadow } from "./GroundShadow";
import { HouseScene } from "./HouseScene";

interface EditorCanvasProps {
  model: SceneModel;
  selectedNodeId: string | null;
  colorOverrides: Record<string, string>;
  onSelect: (nodeId: string) => void;
  interactive: boolean;
}

/**
 * Turns every mesh of the building into a shadow caster and receiver.
 *
 * Done by traversal rather than by threading a prop through several hundred
 * lines of house geometry: the rule is "the whole building casts", and a
 * traversal states exactly that in one place instead of repeating a pair of
 * flags on every mesh in the tree.
 */
function useShadowCasters(
  ref: React.RefObject<THREE.Group | null>,
  model: SceneModel,
) {
  useEffect(() => {
    ref.current?.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [ref, model]);
}

function Building({
  model,
  selectedNodeId,
  colorOverrides,
  onSelect,
}: Omit<EditorCanvasProps, "interactive">) {
  const group = useRef<THREE.Group>(null);
  useShadowCasters(group, model);
  return (
    <group ref={group}>
      <HouseScene
        model={model}
        selectedNodeId={selectedNodeId}
        colorOverrides={colorOverrides}
        onSelect={onSelect}
      />
    </group>
  );
}

export function EditorCanvas({
  model,
  selectedNodeId,
  colorOverrides,
  onSelect,
  interactive,
}: EditorCanvasProps) {
  const { widthM, depthM, heightM } = model.dimensions;
  const roof = model.nodes.find((n) => n.roof)?.roof;
  const rise = roof
    ? roofDimensions(widthM, depthM, roof.overhangM, roof.pitchDeg, roof.shape).rise
    : 0;
  const totalHeight = heightM + rise;
  const span = Math.max(widthM, depthM, totalHeight);

  return (
    <Canvas
      // Transparent on purpose: what surrounds the grid is the page's own
      // blueprint layers, so there is no seam where the canvas begins.
      gl={{
        alpha: true,
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      shadows={{ type: THREE.PCFSoftShadowMap }}
      camera={{ position: [span * 1.72, span * 1.2, span * 1.72], fov: 34 }}
      className="!touch-none"
      // The scene is still unless the reader moves the camera or changes a
      // finish, yet a default canvas re-renders every frame regardless —
      // burning battery and a core to draw an identical picture. On demand,
      // frames are produced only when something actually changed.
      frameloop="demand"
      // Capped at 2, as specified: beyond that a high-density laptop renders
      // four times the pixels for no visible gain.
      dpr={[1, 2]}
    >
      {/* Image-based lighting, built in-scene rather than fetched.
          Poly Haven is unreachable from this environment and drei's HDRI
          presets pull from a CDN, so the environment map is assembled from
          lightformers: a broad sky panel, a key and a cool rim. It gives the
          same job an HDRI does — real specular response and soft falloff on
          the materials — with nothing to download, and it can be tinted to
          the blueprint so the house sits in the page's own light. */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#eaf1ff"
          position={[0, 8, 6]}
          scale={[14, 8, 1]}
          rotation={[-Math.PI / 6, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#9fb6e0"
          position={[-9, 5, -6]}
          scale={[10, 6, 1]}
          rotation={[0, Math.PI / 3, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.7}
          color="#4a6ea8"
          position={[0, -6, 0]}
          scale={[16, 16, 1]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </Environment>

      {/* One key, casting the building's own shadows. The ground does not
          receive it — the contact shadow below owns the floor, and two
          shadows on one plane read as a rendering fault. */}
      <directionalLight
        position={[span * 1.4, span * 2, span * 1.1]}
        intensity={1.6}
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
      <ambientLight intensity={0.25} />

      <BlueprintGround />

      <GroundShadow widthM={widthM} depthM={depthM} />

      <Building
        model={model}
        selectedNodeId={selectedNodeId}
        colorOverrides={colorOverrides}
        onSelect={onSelect}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableRotate={interactive}
        target={[0, totalHeight * 0.42, 0]}
        minDistance={span * 0.9}
        maxDistance={span * 4}
        maxPolarAngle={Math.PI / 2.1}
      />
      <CameraRig model={model} />
    </Canvas>
  );
}
