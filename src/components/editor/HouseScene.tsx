"use client";

import { Edges } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { SceneModel, SceneNode } from "@/lib/3d/types";

interface HouseSceneProps {
  model: SceneModel;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}

/**
 * Renders the mock demo house geometrically from SceneModel node ids.
 * This layout is coupled to the ids MockModel3DProvider produces — a real
 * vendor scene would carry its own mesh/BOM data and this component would
 * read that instead of switching on id.
 */
export function HouseScene({ model, selectedNodeId, onSelect }: HouseSceneProps) {
  const { widthM, depthM, heightM } = model.dimensions;
  const wallHeight = heightM * 0.62;
  const nodeById = (id: string) => model.nodes.find((n) => n.id === id);

  function handleClick(nodeId: string) {
    return (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(nodeId);
    };
  }

  const facadeFront = nodeById("node-facade-front");
  const facadeBack = nodeById("node-facade-back");
  const facadeLeft = nodeById("node-facade-left");
  const facadeRight = nodeById("node-facade-right");
  const roof = nodeById("node-roof");
  const foundation = nodeById("node-foundation");
  const fence = nodeById("node-fence");
  const windows = nodeById("node-windows");

  return (
    <group>
      {foundation && (
        <WallMesh
          node={foundation}
          selected={selectedNodeId === foundation.id}
          onClick={handleClick(foundation.id)}
          position={[0, -0.2, 0]}
          args={[widthM * 1.02, 0.4, depthM * 1.02]}
        />
      )}

      {facadeFront && (
        <WallMesh
          node={facadeFront}
          selected={selectedNodeId === facadeFront.id}
          onClick={handleClick(facadeFront.id)}
          position={[0, wallHeight / 2, depthM / 2]}
          args={[widthM, wallHeight, 0.2]}
        />
      )}
      {facadeBack && (
        <WallMesh
          node={facadeBack}
          selected={selectedNodeId === facadeBack.id}
          onClick={handleClick(facadeBack.id)}
          position={[0, wallHeight / 2, -depthM / 2]}
          args={[widthM, wallHeight, 0.2]}
        />
      )}
      {facadeLeft && (
        <WallMesh
          node={facadeLeft}
          selected={selectedNodeId === facadeLeft.id}
          onClick={handleClick(facadeLeft.id)}
          position={[-widthM / 2, wallHeight / 2, 0]}
          args={[0.2, wallHeight, depthM]}
        />
      )}
      {facadeRight && (
        <WallMesh
          node={facadeRight}
          selected={selectedNodeId === facadeRight.id}
          onClick={handleClick(facadeRight.id)}
          position={[widthM / 2, wallHeight / 2, 0]}
          args={[0.2, wallHeight, depthM]}
        />
      )}

      {roof && (
        <mesh
          position={[0, wallHeight + 0.9, 0]}
          rotation={[0, Math.PI / 4, 0]}
          onClick={handleClick(roof.id)}
        >
          <coneGeometry args={[Math.max(widthM, depthM) * 0.42, 1.8, 4]} />
          <meshStandardMaterial color={roof.colorHex} roughness={0.7} />
          <Edges color={selectedNodeId === roof.id ? "#f4e4c2" : "#2a2620"} />
        </mesh>
      )}

      {fence && (
        <FenceRing
          node={fence}
          selected={selectedNodeId === fence.id}
          onClick={handleClick(fence.id)}
          width={widthM * 1.8}
          depth={depthM * 1.8}
        />
      )}

      {windows &&
        [-1, 0, 1].map((col) => (
          <mesh
            key={col}
            position={[col * (widthM / 4), wallHeight / 2, depthM / 2 + 0.02]}
            onClick={handleClick(windows.id)}
          >
            <boxGeometry args={[0.9, 1.1, 0.05]} />
            <meshStandardMaterial
              color={windows.colorHex}
              roughness={0.2}
              metalness={0.1}
            />
            <Edges color={selectedNodeId === windows.id ? "#f4e4c2" : "#2a2620"} />
          </mesh>
        ))}
    </group>
  );
}

function WallMesh({
  node,
  selected,
  onClick,
  position,
  args,
}: {
  node: SceneNode;
  selected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  position: [number, number, number];
  args: [number, number, number];
}) {
  return (
    <mesh position={position} onClick={onClick}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={node.colorHex} roughness={0.85} />
      <Edges color={selected ? "#f4e4c2" : "#2a2620"} />
    </mesh>
  );
}

function FenceRing({
  node,
  selected,
  onClick,
  width,
  depth,
}: {
  node: SceneNode;
  selected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  width: number;
  depth: number;
}) {
  const h = 1.1;
  const segments: [number, number, number][] = [
    [0, h / 2, depth / 2],
    [0, h / 2, -depth / 2],
  ];
  return (
    <group>
      {segments.map((pos, i) => (
        <mesh key={`h-${i}`} position={pos} onClick={onClick}>
          <boxGeometry args={[width, h, 0.06]} />
          <meshStandardMaterial color={node.colorHex} roughness={0.9} />
          <Edges color={selected ? "#f4e4c2" : "#2a2620"} />
        </mesh>
      ))}
      {[width / 2, -width / 2].map((x, i) => (
        <mesh key={`v-${i}`} position={[x, h / 2, 0]} onClick={onClick}>
          <boxGeometry args={[0.06, h, depth]} />
          <meshStandardMaterial color={node.colorHex} roughness={0.9} />
          <Edges color={selected ? "#f4e4c2" : "#2a2620"} />
        </mesh>
      ))}
    </group>
  );
}
