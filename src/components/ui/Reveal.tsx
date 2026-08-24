"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Plays a group of elements in as it scrolls into view, one after the next.
 *
 * The class is toggled on the DOM node directly rather than through state:
 * the React Compiler's lint forbids setting state synchronously from an
 * effect, and there is nothing here React needs to re-render for — the
 * animation is entirely a CSS concern once the class lands.
 *
 * `index` spaces neighbours by --stagger. Anything past the eighth item stops
 * accumulating delay, so a long grid never leaves its last card waiting.
 */
const MAX_STAGGER_STEPS = 8;

interface RevealProps {
  children: ReactNode;
  /** Position within its group; sets the stagger delay. */
  index?: number;
  className?: string;
}

export function Reveal({ children, index = 0, className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const play = () => el.classList.add("reveal-in");

    // Without IntersectionObserver there is no way to know when the element
    // arrives, and leaving it at opacity 0 would hide the page outright.
    if (typeof IntersectionObserver === "undefined") {
      play();
      return;
    }

    // Already on screen at mount (above the fold): play immediately rather
    // than waiting a frame for the observer to report what we can already see.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      play();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          play();
          observer.disconnect();
        }
      },
      // A little before the edge, so the element is already settled by the
      // time the reader's eye reaches it.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const steps = Math.min(index, MAX_STAGGER_STEPS);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={{ "--reveal-delay": `calc(${steps} * var(--stagger))` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
