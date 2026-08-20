"use client";

import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { SceneModel } from "@/lib/3d/types";
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
  // Frame the whole house including the roof, not just the walls.
  const target: [number, number, number] = [0, heightM * 0.55, 0];
  const span = Math.max(widthM, depthM);

  return (
    <Canvas
      shadows={false}
      camera={{ position: [span * 1.7, span * 1.3, span * 1.7], fov: 34 }}
      className="!touch-none"
    >
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[12, 18, 10]} intensity={1.1} />
      <directionalLight position={[-10, 8, -8]} intensity={0.35} />
      <Grid
        infiniteGrid
        cellColor="#2a2620"
        sectionColor="#2a2620"
        fadeDistance={70}
        fadeStrength={2}
        position={[0, -0.52, 0]}
      />
      <HouseScene
        model={model}
        selectedNodeId={selectedNodeId}
        colorOverrides={colorOverrides}
        onSelect={onSelect}
      />
      <OrbitControls
        enablePan={false}
        enableRotate={interactive}
        target={target}
        minDistance={span * 1.1}
        maxDistance={span * 4}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
