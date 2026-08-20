"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";

/** Never emits; the snapshot pair alone distinguishes server from client. */
const noopSubscribe = () => () => {};

/** False while rendering on the server and during hydration, true after. */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

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
    // The house spans roughly y -0.7…1.65, so it is nudged down to sit
    // centred on the camera target rather than riding high in the frame.
    <group ref={group} position={[0, -0.45, 0]}>
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

/**
 * The motionless form of the reveal. Shown to anyone who prefers reduced
 * motion, and — because it is also the server-rendered tree — briefly to
 * everyone before hydration, so it has to stand on its own as a finished
 * image rather than read as a fallback.
 */
function StaticReveal() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8 sm:gap-8">
      <div className="grid w-full max-w-xs grid-cols-2 gap-3">
        {PHOTOS.map((photo) => (
          <div
            key={photo.id}
            className="flex aspect-[4/3] items-end rounded-lg border border-line bg-surface p-3"
          >
            <span className="text-caption uppercase leading-tight text-cream-dim">
              {photo.label}
            </span>
          </div>
        ))}
      </div>

      <span aria-hidden="true" className="text-h3 leading-none text-cream-dim">
        ↓
      </span>

      <svg
        viewBox="0 0 120 80"
        className="w-full max-w-[15rem] text-cream"
        aria-hidden="true"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M14 30 60 6 106 30" />
          <path d="M22 30v44h76V30" />
          <path d="M22 30h76" />
          <path d="M22 74h76" />
          <path d="M52 74V54h16v20" />
          <path d="M33 42h12v12H33zM75 42h12v12H75z" />
        </g>
      </svg>
    </div>
  );
}

export function PhotoToModelReveal() {
  const reducedMotion = useReducedMotion();
  // `useReducedMotion` can only read the media query in the browser, so the
  // server and the first client render must agree on something else. The
  // static reveal is that shared starting point: it is the accessible,
  // no-JS-safe default, and we upgrade to the animated version only once
  // mounted and only when motion is welcome. Rendering the animation first
  // would both break hydration and flash motion at reduced-motion users.
  const hydrated = useHydrated();

  const animated = hydrated && !reducedMotion;
  const phase = useRevealCycle(!animated);

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
      {!animated ? (
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
              <Canvas camera={{ position: [4.6, 3.1, 4.6], fov: 34 }}>
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
