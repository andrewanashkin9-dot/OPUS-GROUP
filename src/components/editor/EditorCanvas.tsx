"use client";

import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { SceneModel } from "@/lib/3d/types";
import { HouseScene } from "./HouseScene";

interface EditorCanvasProps {
  model: SceneModel;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  interactive: boolean;
}

export function EditorCanvas({
  model,
  selectedNodeId,
  onSelect,
  interactive,
}: EditorCanvasProps) {
  const wallHeight = model.dimensions.heightM * 0.62;
  const target: [number, number, number] = [0, wallHeight * 0.3, 0];
  const span = Math.max(model.dimensions.widthM, model.dimensions.depthM);

  return (
    <Canvas
      shadows={false}
      camera={{ position: [span * 1.7, span * 1.3, span * 1.7], fov: 34 }}
      className="!touch-none"
    >
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 10, 4]} intensity={0.9} />
      <directionalLight position={[-6, 4, -4]} intensity={0.3} />
      <Grid
        infiniteGrid
        cellColor="#2a2620"
        sectionColor="#2a2620"
        fadeDistance={28}
        fadeStrength={2}
        position={[0, -0.4, 0]}
      />
      <HouseScene model={model} selectedNodeId={selectedNodeId} onSelect={onSelect} />
      <OrbitControls
        enablePan={false}
        enableRotate={interactive}
        target={target}
        minDistance={span * 1.1}
        maxDistance={span * 3.5}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
