"use client";

import { useEffect, useRef } from "react";
import { ButtonLink } from "./Button";

/**
 * The first screen: a camera move from the corner of a dark room to a lit
 * drafting table, driven entirely by the user's scroll.
 *
 * The video never plays itself — scroll position is mapped onto
 * `currentTime`, so the move runs forward and backward under the reader's
 * thumb. The asset is encoded with every frame a keyframe precisely so this
 * seeking is smooth; re-compressing it with an ordinary web preset would
 * strip that and make the scrub stutter.
 *
 * When the camera arrives, the blueprint stays: the video holds on its final
 * frame and the headline sits on top of it. Holding the real frame is the
 * only way the arrival is genuinely seamless — the blueprint in shot is in
 * perspective behind a paper edge, so no CSS grid could match it.
 */

/** Fraction of the scrub reserved for the headline to arrive. */
const CONTENT_FADE_START = 0.8;

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function ScrollScrubHero() {
  const trackRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const video = videoRef.current;
    const content = contentRef.current;
    const hint = hintRef.current;
    if (!track || !video || !content || !hint) return;

    // Reduced motion is handled entirely in CSS; the only thing left to do
    // here is not fetch six megabytes of video nobody will see.
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    video.preload = "auto";
    video.load();

    let ticking = false;
    let lastSeek = -1;

    const apply = () => {
      ticking = false;

      const total = track.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      // Measured in real pixels rather than from the CSS units, so the svh/vh
      // distinction and mobile URL-bar resizes cannot desynchronise the scrub.
      const progress = clamp01(-track.getBoundingClientRect().top / total);

      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0) {
        // The last frame is held rather than passed, so the arrival rests on
        // a real frame instead of running off the end of the timeline.
        const t = Math.min(progress * duration, duration - 0.001);
        // Sub-frame seeks are wasted work and can queue up on slower decoders.
        if (Math.abs(t - lastSeek) > 1 / 60) {
          lastSeek = t;
          video.currentTime = t;
        }
      }

      const reveal = clamp01(
        (progress - CONTENT_FADE_START) / (1 - CONTENT_FADE_START),
      );
      content.style.opacity = String(reveal);
      // Once the copy is legible the pointer should fall through to nothing
      // underneath it; before that it must not swallow clicks.
      content.style.pointerEvents = reveal > 0.5 ? "auto" : "none";
      content.style.transform = `translateY(${(1 - reveal) * 16}px)`;

      hint.style.opacity = String(clamp01(1 - progress * 12));
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };

    // iOS will not honour a seek until the media is primed. A muted play
    // immediately paused satisfies that; if the browser refuses, seeking
    // still works everywhere else, so the rejection is not an error.
    const prime = () => {
      const played = video.play();
      if (played) played.then(() => video.pause()).catch(() => {});
    };

    video.addEventListener("loadedmetadata", apply);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("pointerdown", prime, { once: true });

    prime();
    apply();

    return () => {
      video.removeEventListener("loadedmetadata", apply);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointerdown", prime);
    };
  }, []);

  return (
    // Pulled up under the sticky nav so the pinned frame is exactly one
    // viewport tall. Left in normal flow it starts below the nav, and its
    // bottom band — where the scroll hint lives — hangs off the fold at rest,
    // hiding the hint at the only moment it is meant to be visible.
    <section ref={trackRef} className="hero-track relative -mt-16">
      <div className="sticky top-0 z-0 h-svh w-full overflow-hidden bg-bg">
        <video
          ref={videoRef}
          className="hero-video absolute inset-0 h-full w-full object-cover"
          src="/assets/hero-zoom.mp4"
          poster="/assets/hero-zoom-poster.jpg"
          muted
          playsInline
          preload="none"
          // Decorative: the headline carries the meaning for screen readers.
          aria-hidden="true"
          tabIndex={-1}
        />
        {/* Reduced motion arrives already there, with no video fetched. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/hero-zoom-end.jpg"
          alt=""
          aria-hidden="true"
          className="hero-still absolute inset-0 h-full w-full object-cover"
        />

        {/* Keeps cream type legible over the blueprint without introducing a
            colour — black at low alpha, weighted to the bottom third. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 28%, rgba(0,0,0,0.12) 58%, rgba(0,0,0,0) 80%)",
          }}
        />

        <div className="absolute inset-0 flex items-end justify-center pb-[12svh]">
          <div
            ref={contentRef}
            className="hero-content mx-auto max-w-4xl px-4 text-center will-change-[opacity,transform]"
          >
            {/* Full cream, not the dim tone used elsewhere: the scrim is
                thinnest at this height, and dim cream over the blueprint
                falls to roughly 3.4:1 — under the floor for small text. */}
            <p className="text-caption font-medium uppercase text-cream">
              Фото → 3D-модель → смета → бригада
            </p>
            <h1 className="font-display mt-4 text-display font-extrabold tracking-tight text-cream-bright">
              Ваш дом в 3D — из четырёх фотографий
            </h1>
            <p className="prose-measure mx-auto mt-5 text-body-l text-cream">
              Загрузите фото дома — и настройте крышу, фасад и забор прямо в
              модели. Материалы и стоимость считаются сами.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <ButtonLink href="/editor">Загрузить фото дома</ButtonLink>
              <ButtonLink href="/#how-it-works" variant="secondary">
                Как это работает
              </ButtonLink>
            </div>
          </div>
        </div>

        <p
          ref={hintRef}
          className="hero-hint absolute inset-x-0 bottom-6 text-center text-caption uppercase text-cream-dim"
        >
          Листайте, чтобы приблизиться
        </p>
      </div>
    </section>
  );
}
