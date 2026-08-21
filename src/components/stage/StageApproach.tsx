"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The move between stages, played as a camera travelling to the object on the
 * drafting table that the next stage happens on.
 *
 *   design    the drawing itself, under a scale rule and a pencil
 *   estimate  the phone the order continues on
 *   services  the notebook inside that phone, options entered down the page
 *
 * Drawn rather than rendered in 3D on purpose. A second WebGL context costs
 * more to create than this whole animation lasts, and browsers cap how many
 * may exist at once — spending one on a one-second flourish risks the
 * editor's own canvas being dropped on a phone. Cream line work is also the
 * logo's own language, so the objects arrive already looking like the brand.
 *
 * It is decoration over content that has already rendered: never blocking,
 * hidden from assistive tech, dismissed by any input, and skipped entirely
 * when reduced motion is asked for.
 */

export type Stage = "design" | "estimate" | "services";

const DURATION_MS = 1250;

const CAPTIONS: Record<Stage, string> = {
  design: "Чертёжный стол",
  estimate: "Смета — продолжаем в телефоне",
  services: "Блокнот с услугами",
};

export function StageApproach({ stage }: { stage: Stage }) {
  // Starts on: the animation is the point, and beginning in state means the
  // server and the first client render agree. Reduced motion hides it in CSS
  // rather than in a render branch — the effect only ever stops it, so no
  // state is set synchronously during mount.
  const [playing, setPlaying] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stop = () => {
      setPlaying(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    timerRef.current = setTimeout(stop, DURATION_MS);

    // Any deliberate input means the reader is ahead of the animation.
    const opts = { passive: true, once: true } as const;
    window.addEventListener("pointerdown", stop, opts);
    window.addEventListener("keydown", stop, opts);
    window.addEventListener("wheel", stop, opts);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("wheel", stop);
    };
  }, [stage]);

  if (!playing) return null;

  return (
    <div
      aria-hidden="true"
      className="stage-approach pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{
        // The blueprint's own blue, dropped almost to black: the reader is
        // still over the table, just between objects.
        background:
          "radial-gradient(120% 90% at 50% 45%, rgba(17,51,93,0.55) 0%, rgba(0,0,0,0.94) 62%, #000 100%)",
        animation: `stage-scrim ${DURATION_MS}ms ease-out forwards`,
      }}
    >
      <div
        className="w-[min(78vw,560px)]"
        style={{
          animation: `stage-approach ${DURATION_MS}ms cubic-bezier(0.32, 0, 0.2, 1) forwards`,
        }}
      >
        {stage === "design" ? <DrawingWithTools /> : <PhoneStage stage={stage} />}
      </div>

      <p
        className="absolute inset-x-0 bottom-[14svh] text-center text-caption font-medium uppercase text-cream"
        style={{ animation: `stage-caption ${DURATION_MS}ms ease-out forwards` }}
      >
        {CAPTIONS[stage]}
      </p>
    </div>
  );
}

/** A corner of the drawing, with the rule and pencil lying across it. */
function DrawingWithTools() {
  return (
    <svg viewBox="0 0 200 140" className="w-full" fill="none" aria-hidden="true">
      {/* Sheet */}
      <rect x="12" y="10" width="176" height="120" rx="1.5" fill="#11335d" />
      <g stroke="#E4D2AC" strokeOpacity="0.16" strokeWidth="0.5">
        {Array.from({ length: 17 }, (_, i) => (
          <line key={`v${i}`} x1={12 + i * 11} y1="10" x2={12 + i * 11} y2="130" />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={`h${i}`} x1="12" y1={10 + i * 11} x2="188" y2={10 + i * 11} />
        ))}
      </g>
      {/* Border and a plan being drawn */}
      <rect x="12" y="10" width="176" height="120" rx="1.5" stroke="#E4D2AC" strokeOpacity="0.5" strokeWidth="1" />
      <rect x="20" y="18" width="160" height="104" stroke="#E4D2AC" strokeOpacity="0.28" strokeWidth="0.6" />
      <g stroke="#F4E4C2" strokeOpacity="0.75" strokeWidth="1.1">
        <rect x="58" y="42" width="84" height="56" />
        <path d="M58 42 142 98M142 42 58 98" strokeOpacity="0.3" strokeWidth="0.6" />
        <path d="M58 34h84M58 31v6M142 31v6" strokeOpacity="0.55" strokeWidth="0.7" />
      </g>

      {/* Yellow scale rule */}
      <g transform="rotate(-8 100 112)">
        <rect x="26" y="104" width="150" height="13" rx="1.5" fill="#E8B93C" />
        <rect x="26" y="104" width="150" height="13" rx="1.5" stroke="#7a5a12" strokeOpacity="0.6" strokeWidth="0.8" />
        {Array.from({ length: 25 }, (_, i) => (
          <line
            key={i}
            x1={30 + i * 6}
            y1="104"
            x2={30 + i * 6}
            y2={i % 4 === 0 ? 111 : 108}
            stroke="#3a2a08"
            strokeOpacity="0.8"
            strokeWidth={i % 4 === 0 ? 1 : 0.6}
          />
        ))}
      </g>

      {/* Pencil */}
      <g transform="rotate(24 140 60)">
        <rect x="104" y="56" width="74" height="8" rx="1" fill="#D8A32B" />
        <rect x="104" y="56" width="74" height="8" rx="1" stroke="#7a5a12" strokeOpacity="0.5" strokeWidth="0.6" />
        <path d="M104 56 92 60l12 4z" fill="#E8D8B8" />
        <path d="M95.5 58.8 92 60l3.5 1.2z" fill="#1C1A17" />
        <rect x="178" y="56" width="6" height="8" fill="#9AA0A6" />
        <rect x="184" y="56.6" width="6" height="6.8" rx="1.4" fill="#C97F72" />
      </g>
    </svg>
  );
}

/** The phone the order continues on — showing the estimate, or the notebook. */
function PhoneStage({ stage }: { stage: Stage }) {
  const rows =
    stage === "estimate"
      ? ["Крыша", "Фасад", "Окна", "Фундамент"]
      : ["Кровельщики", "Фасадчики", "Забор", "Окна", "Фундамент"];

  return (
    <svg viewBox="0 0 200 140" className="w-full" fill="none" aria-hidden="true">
      {/* Body */}
      <rect x="66" y="6" width="68" height="128" rx="10" fill="#17181A" stroke="#E4D2AC" strokeOpacity="0.35" strokeWidth="1" />
      <rect x="70" y="14" width="60" height="112" rx="4" fill="#0A0C10" />
      <rect x="90" y="9.5" width="20" height="2.6" rx="1.3" fill="#E4D2AC" fillOpacity="0.35" />

      {/* Screen head */}
      <g>
        <rect x="76" y="20" width="24" height="3" rx="1.5" fill="#8A7F6A" />
        <rect x="76" y="27" width="48" height="5" rx="1.5" fill="#F4E4C2" fillOpacity="0.9" />
      </g>

      {stage === "services" && (
        // A notebook opening inside the phone: ruled page, entries in a column.
        <g>
          <rect x="74" y="37" width="52" height="70" rx="2" fill="#11335d" fillOpacity="0.55" stroke="#E4D2AC" strokeOpacity="0.3" strokeWidth="0.6" />
          <line x1="82" y1="37" x2="82" y2="107" stroke="#E4D2AC" strokeOpacity="0.3" strokeWidth="0.5" />
        </g>
      )}

      {/* Entries, written one after another down the page */}
      {rows.map((label, i) => (
        <g
          key={label}
          style={{
            animation: `stage-entry 260ms ease-out ${180 + i * 90}ms both`,
          }}
        >
          {stage === "services" ? (
            <>
              <path
                d={`M85.5 ${47 + i * 12}l2 2 4-4.5`}
                stroke="#E4D2AC"
                strokeOpacity="0.85"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="94" y={43.5 + i * 12} width={24 - (i % 3) * 4} height="3" rx="1.5" fill="#E4D2AC" fillOpacity="0.7" />
            </>
          ) : (
            <>
              <rect x="76" y={42 + i * 14} width={22 - (i % 2) * 5} height="3" rx="1.5" fill="#E4D2AC" fillOpacity="0.62" />
              <rect x="108" y={42 + i * 14} width="16" height="3" rx="1.5" fill="#F4E4C2" fillOpacity="0.85" />
              <line x1="76" y1={49 + i * 14} x2="124" y2={49 + i * 14} stroke="#E4D2AC" strokeOpacity="0.14" strokeWidth="0.5" />
            </>
          )}
        </g>
      ))}

      {/* Total, or the request button */}
      {stage === "estimate" ? (
        <g style={{ animation: "stage-entry 300ms ease-out 560ms both" }}>
          <line x1="76" y1="104" x2="124" y2="104" stroke="#E4D2AC" strokeOpacity="0.3" strokeWidth="0.6" />
          <rect x="76" y="109" width="18" height="4" rx="2" fill="#8A7F6A" />
          <rect x="102" y="108.5" width="22" height="5" rx="2.5" fill="#F4E4C2" />
        </g>
      ) : (
        <g style={{ animation: "stage-entry 300ms ease-out 640ms both" }}>
          <rect x="80" y="112" width="40" height="8" rx="4" fill="#E4D2AC" />
        </g>
      )}
    </svg>
  );
}
