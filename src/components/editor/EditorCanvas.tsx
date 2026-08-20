"use client";

import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { roofDimensions } from "@/lib/3d/roof-geometry";
import type { SceneModel } from "@/lib/3d/types";
import { CameraRig } from "./CameraRig";
import { HouseScene } from "./HouseScene";

interface EditorCanvasProps {
  model: SceneModel;
  selectedNodeId: string | null;
  colorOverrides: Record<string, string>;
  onSelect: (nodeId: string) => void;
  interactive: boolean;
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
    ? roofDimensions(widthM, depthM, roof.overhangM, roof.pitchDeg, roof.shape)
        .rise
    : 0;
  const totalHeight = heightM + rise;
  const span = Math.max(widthM, depthM, totalHeight);

  return (
    <Canvas
      shadows={false}
      camera={{ position: [span * 1.55, span * 1.1, span * 1.55], fov: 34 }}
      className="!touch-none"
    >
      <color attach="background" args={["#000000"]} />

      {/* Dark facades sit against a black page, so the lighting has to do the
          separating: a sky/ground hemisphere for base tone, a key light, and
          a rim light that catches the far edges. */}
      <hemisphereLight args={["#cfd6dd", "#161412", 0.7]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[16, 22, 12]} intensity={1.15} />
      <directionalLight position={[-14, 10, -10]} intensity={0.5} />
      <directionalLight position={[0, 6, -18]} intensity={0.35} />

      <Grid
        infiniteGrid
        cellColor="#2a2620"
        sectionColor="#2a2620"
        fadeDistance={90}
        fadeStrength={2}
        position={[0, -0.02, 0]}
      />
      <HouseScene
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
