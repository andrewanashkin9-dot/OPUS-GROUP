"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const PHOTOS = [
  { id: "front", label: "Главный фасад" },
  { id: "back", label: "Задний фасад" },
  { id: "left", label: "Левый фасад" },
  { id: "right", label: "Правый фасад" },
];

type Phase = "photos" | "sweep" | "model";

function useRevealCycle(paused: boolean) {
  const [phase, setPhase] = useState<Phase>("photos");

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    function run() {
      setPhase("photos");
      timers.push(setTimeout(() => !cancelled && setPhase("sweep"), 1500));
      timers.push(setTimeout(() => !cancelled && setPhase("model"), 2300));
      timers.push(setTimeout(() => !cancelled && run(), 5800));
    }
    run();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [paused]);

  return phase;
}

function WireHouse() {
  const group = useRef<THREE.Group>(null);
  const wallsEdges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(2.2, 1.4, 1.8)),
    [],
  );
  const roofEdges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.ConeGeometry(1.7, 1, 4)),
    [],
  );

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.3;
  });

  return (
    <group ref={group}>
      <lineSegments geometry={wallsEdges}>
        <lineBasicMaterial color="#e4d2ac" />
      </lineSegments>
      <lineSegments
        geometry={roofEdges}
        position={[0, 1.15, 0]}
        rotation={[0, Math.PI / 4, 0]}
      >
        <lineBasicMaterial color="#f4e4c2" />
      </lineSegments>
    </group>
  );
}

function PhotosStack({ swept }: { swept: boolean }) {
  return (
    <div className="relative h-full w-full">
      {PHOTOS.map((photo, i) => (
        <motion.div
          key={photo.id}
          initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40, y: -20, rotate: 0 }}
          animate={{
            opacity: 1,
            x: 0,
            y: i * 6,
            rotate: (i - 1.5) * 4,
          }}
          transition={{ delay: i * 0.12, duration: 0.5, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 flex h-40 w-56 -translate-x-1/2 -translate-y-1/2 flex-col justify-end rounded-lg border p-3"
          style={{
            zIndex: i,
            borderColor: swept ? "#f4e4c2" : "#2a2620",
            background: "#0d0c0a",
          }}
        >
          <span className="font-body text-caption uppercase tracking-wide text-cream-dim">
            {photo.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function StaticReveal() {
  return (
    <div className="grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
      <div className="grid grid-cols-2 gap-2">
        {PHOTOS.map((photo) => (
          <div
            key={photo.id}
            className="flex h-16 items-end rounded-md border border-line bg-surface p-2"
          >
            <span className="text-caption uppercase text-cream-dim">
              {photo.label}
            </span>
          </div>
        ))}
      </div>
      <span aria-hidden="true" className="text-h2 text-cream-dim">
        →
      </span>
      <svg viewBox="0 0 120 100" className="h-24 w-full text-cream" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M20 30 60 8 100 30" />
          <path d="M20 30v40h80V30" />
          <path d="M20 30 100 30" />
          <path d="M20 70h80" />
          <path d="M45 70V50h20v20" />
        </g>
      </svg>
    </div>
  );
}

export function PhotoToModelReveal() {
  const reducedMotion = useReducedMotion();
  const phase = useRevealCycle(!!reducedMotion);

  return (
    <div
      role="img"
      aria-label="Анимация: четыре фотографии дома превращаются в 3D-модель"
      className="relative aspect-square w-full overflow-hidden rounded-2xl border border-line bg-bg"
      style={{
        backgroundImage:
          "linear-gradient(#15130f 1px, transparent 1px), linear-gradient(90deg, #15130f 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      {reducedMotion ? (
        <StaticReveal />
      ) : (
        <AnimatePresence mode="wait">
          {phase === "model" ? (
            <motion.div
              key="model"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="h-full w-full"
            >
              <Canvas camera={{ position: [3.2, 2.2, 3.2], fov: 40 }}>
                <WireHouse />
              </Canvas>
            </motion.div>
          ) : (
            <motion.div
              key="photos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="relative h-full w-full"
            >
              <PhotosStack swept={phase === "sweep"} />
              {phase === "sweep" && (
                <motion.div
                  initial={{ left: "-10%" }}
                  animate={{ left: "110%" }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className="absolute top-0 h-full w-px"
                  style={{ background: "#f4e4c2", boxShadow: "0 0 24px 1px #f4e4c2" }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
