"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { CLIPS, preloadClip, type TransitionId } from "@/lib/transitions";
import { transitionStore } from "./transition-store";

/**
 * A one-shot shot between stages: the drafting table as the model opens, and
 * the pan into the phone as the order moves to materials.
 *
 * Deliberately not the hero's technique. The hero is scrubbed, so it needs an
 * all-keyframe encode, a buffered blob and frame-snapped seeks. These play
 * forward exactly once and are never scrubbed, so they need none of that —
 * only a poster holding the final frame and a fade that hands off to the
 * interface underneath.
 *
 * The clip that ends on a lit phone screen carries a bloom out of that screen
 * as it leaves (`bloom`), so the last frame dissolves into the page's own
 * background instead of cutting from a bright screen to black.
 */

interface SectionTransitionProps {
  id: TransitionId;
  /**
   * Play only when the control that navigated here armed this transition.
   * The move into the estimate belongs to that one action; arriving at the
   * same page from a bookmark or the nav bar is not that move.
   */
  requireArm?: boolean;
  /** Carry the final frame's light into the page as the clip leaves. */
  bloom?: boolean;
  /** Warm this clip while the browser is idle once the current one is done. */
  preloadNext?: TransitionId;
}

const LEAVE_MS = 520;
const REDUCED_LEAVE_MS = 200;
/** How long past its own duration a stalled clip may hold the screen. */
const STALL_GRACE_MS = 1500;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SectionTransition({
  id,
  requireArm = false,
  bloom = false,
  preloadNext,
}: SectionTransitionProps) {
  const phase = useSyncExternalStore(
    transitionStore.subscribe,
    () => transitionStore.snapshot(id),
    transitionStore.serverSnapshot,
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const clip = CLIPS[id];

  // Whether to play at all depends on sessionStorage, which the server cannot
  // read. Asking here — after mount, through the store — keeps the server and
  // the hydrating client rendering the same nothing.
  useEffect(() => {
    transitionStore.request(id, requireArm);
  }, [id, requireArm]);

  const leave = useCallback(() => transitionStore.leave(id), [id]);

  useEffect(() => {
    if (phase !== "playing") return;

    const reduced = prefersReducedMotion();
    const video = videoRef.current;

    if (reduced) {
      // Nothing plays: the poster is the whole transition, and it is on its
      // way out as soon as it has been seen.
      const timer = window.setTimeout(leave, REDUCED_LEAVE_MS);
      return () => window.clearTimeout(timer);
    }

    // Autoplay can be refused outright. If it is, the clip is skipped rather
    // than left as a frozen still over the interface.
    void video?.play().catch(leave);

    // A clip that never fires `ended` — a decode failure, a suspended tab —
    // must not be able to hold the screen indefinitely.
    const ceiling = window.setTimeout(
      leave,
      clip.durationS * 1000 + STALL_GRACE_MS,
    );

    // Any deliberate input means the reader is ahead of the animation.
    const opts = { passive: true, once: true } as const;
    window.addEventListener("keydown", leave, opts);
    window.addEventListener("wheel", leave, opts);

    return () => {
      window.clearTimeout(ceiling);
      window.removeEventListener("keydown", leave);
      window.removeEventListener("wheel", leave);
    };
  }, [phase, leave, clip.durationS]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const out = prefersReducedMotion() ? REDUCED_LEAVE_MS : LEAVE_MS;
    const timer = window.setTimeout(() => {
      transitionStore.end(id);
      if (preloadNext) preloadClip(preloadNext);
    }, out);
    return () => window.clearTimeout(timer);
  }, [phase, id, preloadNext]);

  // Nothing to warm up if this clip is not going to play: the next stage's
  // clip is still worth having in cache by the time the reader gets there.
  useEffect(() => {
    if (phase === "idle" && preloadNext) preloadClip(preloadNext);
  }, [phase, preloadNext]);

  if (phase === "idle") return null;

  return (
    <div
      data-leaving={phase === "leaving"}
      style={{ "--clip-out": `${LEAVE_MS}ms` } as React.CSSProperties}
      className="clip-layer fixed inset-0 z-[60] overflow-hidden bg-bg"
    >
      <video
        ref={videoRef}
        className="clip-video h-full w-full object-cover"
        src={clip.src}
        poster={clip.poster}
        preload="auto"
        muted
        playsInline
        aria-hidden="true"
        onEnded={leave}
        onError={leave}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- the reduced-motion
          still is one fixed asset shown at viewport size; the image optimiser
          would add a network round trip to serve the same file. */}
      <img
        className="clip-still h-full w-full object-cover"
        src={clip.poster}
        alt={clip.alt}
      />

      {/* The phone screen's light, spreading out and dying into the page. */}
      {bloom && phase === "leaving" && (
        <div className="clip-bloom pointer-events-none absolute inset-0" />
      )}

      <button
        type="button"
        onClick={leave}
        className="clip-skip absolute bottom-6 right-6 rounded-full border border-line bg-bg/70 px-4 py-2 text-body-s font-medium text-cream backdrop-blur transition-colors hover:border-cream-dim hover:text-cream-bright"
      >
        Пропустить
      </button>
    </div>
  );
}
