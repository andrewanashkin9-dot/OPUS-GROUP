"use client";

import { useEffect, useRef } from "react";
import { ButtonLink } from "./Button";
import { HeroRender } from "./HeroRender";
import { TitleBlock } from "./TitleBlock";

/**
 * The first screen: a camera move from the corner of a dark room to a lit
 * drafting table, driven entirely by the user's scroll.
 *
 * Three things decide whether this reads as a smooth camera move or as a
 * stuttering slideshow, and all three are handled below:
 *
 *  1. Seeking must never touch the network. The whole clip is fetched once
 *     into memory and played from a blob, so every seek is a decode rather
 *     than a range request. Seeking a partially buffered video is the single
 *     biggest source of stutter.
 *  2. Scroll input is not continuous. A wheel notch jumps ~100px at a time,
 *     so mapping scroll straight onto currentTime inherits those steps. A
 *     rAF loop eases the playhead toward the scroll target instead, turning
 *     discrete input into continuous motion.
 *  3. Seeks must not pile up. The source is 30fps, so anything finer than a
 *     frame is a wasted seek; the playhead is snapped to frame boundaries and
 *     a new seek waits for the previous one to land.
 *
 * The asset is encoded with every frame a keyframe precisely so seeking is
 * cheap; re-compressing it with an ordinary web preset would strip that.
 */

const VIDEO_SRC = "/assets/hero-zoom.mp4";

/**
 * Source frame rate. Seeks are snapped to this grid, so it must match the
 * asset: the clip is 60fps, and snapping to 30 would throw away half the
 * frames the file carries.
 */
const FPS = 60;

/** Fraction of the scrub reserved for the headline to arrive. */
const CONTENT_FADE_START = 0.8;

/**
 * Playhead catch-up rate, per second, applied frame-rate independently so the
 * feel is identical at 60Hz and 120Hz. Higher tracks the finger more tightly;
 * lower feels heavier. ~14 keeps the move responsive without reintroducing
 * the steps of the raw scroll.
 */
const CATCH_UP = 14;

/** Below this the playhead is treated as settled and the loop parks. */
const SETTLED = 0.0004;

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function ScrollScrubHero() {
  const trackRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const video = videoRef.current;
    const content = contentRef.current;
    const frame = frameRef.current;
    const hint = hintRef.current;
    if (!track || !video || !content || !hint) return;

    // Reduced motion is handled entirely in CSS. The only thing left here is
    // to not fetch six megabytes of video nobody will see.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetProgress = 0;
    let easedProgress = 0;
    let appliedFrame = -1;
    let rafId = 0;
    let running = false;
    let lastTick = 0;
    let disposed = false;
    let objectUrl: string | null = null;

    const measure = () => {
      const total = track.offsetHeight - window.innerHeight;
      // Measured in real pixels rather than from the CSS units, so the svh/vh
      // distinction and mobile URL-bar resizes cannot desynchronise the scrub.
      targetProgress =
        total > 0 ? clamp01(-track.getBoundingClientRect().top / total) : 0;
    };

    const tick = (now: number) => {
      const dt = Math.min((now - lastTick) / 1000, 0.05);
      lastTick = now;

      // Exponential approach: frame-rate independent, so a 120Hz display and a
      // 60Hz one settle over the same wall-clock time.
      easedProgress +=
        (targetProgress - easedProgress) * (1 - Math.exp(-CATCH_UP * dt));
      if (Math.abs(targetProgress - easedProgress) < SETTLED) {
        easedProgress = targetProgress;
      }

      let frameOutstanding = false;
      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0) {
        // Hold the last frame rather than running off the end of the timeline.
        const maxFrame = Math.max(0, Math.round(duration * FPS) - 1);
        const wanted = Math.min(
          Math.round(easedProgress * duration * FPS),
          maxFrame,
        );
        if (wanted !== appliedFrame) {
          if (video.seeking) {
            // A seek is already in flight; applying another now would queue up
            // work the decoder discards. `seeked` restarts the loop.
            frameOutstanding = true;
          } else {
            appliedFrame = wanted;
            video.currentTime = wanted / FPS;
          }
        }
      }

      const reveal = clamp01(
        (easedProgress - CONTENT_FADE_START) / (1 - CONTENT_FADE_START),
      );
      // Prologue handoff: the footage dissolves and the blueprint sheet it was
      // sitting on all along is what remains. Fading a touch ahead of the copy
      // means the headline lands on clean paper, not over a half-gone room.
      if (frame) frame.style.opacity = String(clamp01(1 - reveal * 1.25));
      content.style.opacity = String(reveal);
      // Before the copy is legible it must not swallow clicks.
      content.style.pointerEvents = reveal > 0.5 ? "auto" : "none";
      content.style.transform = `translate3d(0, ${(1 - reveal) * 16}px, 0)`;
      hint.style.opacity = String(clamp01(1 - easedProgress * 12));

      if (easedProgress !== targetProgress || frameOutstanding) {
        rafId = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    const kick = () => {
      if (running || disposed) return;
      running = true;
      lastTick = performance.now();
      rafId = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      measure();
      kick();
    };

    // Fetching the clip whole means every later seek is served from memory.
    // Streaming it instead leaves seeks waiting on range requests, which is
    // what makes a scrubbed video stutter.
    const abort = new AbortController();
    fetch(VIDEO_SRC, { signal: abort.signal })
      .then((r) =>
        r.ok ? r.blob() : Promise.reject(new Error(String(r.status))),
      )
      .then((blob) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        video.src = objectUrl;
        video.load();
      })
      .catch(() => {
        // Offline, blocked, or aborted: stream it instead. Seeks may be less
        // smooth, but the hero still works rather than sitting on the poster.
        if (!disposed && !video.src) {
          video.src = VIDEO_SRC;
          video.load();
        }
      });

    // iOS will not honour a seek until the media is primed. A muted play
    // immediately paused satisfies that; a refusal is not an error.
    const prime = () => {
      const played = video.play();
      if (played) played.then(() => video.pause()).catch(() => {});
    };

    video.addEventListener("loadeddata", kick);
    video.addEventListener("seeked", kick);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("pointerdown", prime, { once: true });

    measure();
    // Jump straight to the scroll position rather than easing up to it, so a
    // reload part-way down the track does not animate from the first frame.
    easedProgress = targetProgress;
    kick();

    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(rafId);
      video.removeEventListener("loadeddata", kick);
      video.removeEventListener("seeked", kick);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointerdown", prime);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return (
    // Pulled up under the sticky nav so the pinned frame is exactly one
    // viewport tall. Left in normal flow it starts below the nav, and its
    // bottom band — where the scroll hint lives — hangs off the fold at rest,
    // hiding the hint at the only moment it is meant to be visible.
    <section ref={trackRef} className="hero-track relative -mt-16">
      {/* Transparent, not filled: as the footage fades the fixed blueprint
          layers behind the whole document are what shows through. */}
      <div className="sticky top-0 z-0 h-svh w-full overflow-hidden">
        <div ref={frameRef} className="absolute inset-0">
          {/* No `src` here on purpose: the element would stream the file while
            the effect fetches it too, downloading six megabytes twice. */}
          <video
            ref={videoRef}
            className="hero-video absolute inset-0 h-full w-full object-cover"
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

          {/* Grades the warm footage toward the sheet it is handing off to, and
            keeps type legible over it — the deep blue of the paper rather than
            a neutral black, so the two worlds meet in one colour. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(7,18,41,0.88) 0%, rgba(7,18,41,0.6) 28%, rgba(7,18,41,0.16) 58%, rgba(7,18,41,0) 80%)",
            }}
          />
        </div>

        <div className="hero-stage absolute inset-0 flex items-center justify-center px-4 pb-16 pt-20">
          <div className="hero-tilt w-full max-w-6xl">
            {/* One arrangement that adapts, rather than a layout with the
                picture switched off below a cutoff. Stacked on a phone with
                the render on top; two columns from md upward, which is what
                actually rescues a short landscape screen — there the width is
                plentiful and only the height is scarce, so putting the two
                side by side costs no vertical room at all.

                Gated on width alone. Height is handled by the render's box
                shrinking and the picture cropping, never by hiding it. */}
            <div
              ref={contentRef}
              className="hero-content flex flex-col gap-5 will-change-[opacity,transform] md:grid md:grid-cols-[1.05fr_1fr] md:items-center md:gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10"
            >
              <HeroRender className="hero-render min-w-0" />
              <div className="plate min-w-0 px-5 py-6 text-center sm:px-8 sm:py-9 md:text-left">
                {/* Full cream, not the dim tone used elsewhere: the scrim is
                thinnest at this height, and dim cream over the blueprint
                falls to roughly 3.4:1 — under the floor for small text. */}
                <p className="text-caption font-medium uppercase text-accent">
                  Фото → 3D-модель → смета → бригада
                </p>
                <h1 className="font-display mt-4 text-display font-extrabold tracking-tight text-white">
                  Ваш дом в 3D — из четырёх фотографий
                </h1>
                <p className="prose-measure mx-auto mt-4 text-body-l text-soft md:mx-0">
                  Загрузите фото дома — и настройте крышу, фасад и забор прямо в
                  модели. Материалы и стоимость считаются сами.
                </p>
                <div className="hero-cta mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
                  <ButtonLink href="/editor">Загрузить фото дома</ButtonLink>
                  <ButtonLink href="/#how-it-works" variant="secondary">
                    Как это работает
                  </ButtonLink>
                </div>

                {/* The stamp at the foot of the sheet. On the landing it
                  describes the sample project; in the editor the same block
                  carries the reader's own house, live. */}
                <TitleBlock
                  className="mt-7 !bg-transparent !shadow-none sm:mt-9"
                  fields={[
                    { label: "Объект", value: "Частный дом" },
                    {
                      label: "Габариты",
                      value: "9,5 × 8,2 м",
                      secondary: true,
                    },
                    { label: "Этажность", value: "2 этажа" },
                    { label: "Площадь фасадов", value: "186,7 м²" },
                    { label: "Смета", value: "1 526 203 ₽", accent: true },
                    { label: "Масштаб", value: "1:100", secondary: true },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        <p
          ref={hintRef}
          className="hero-hint absolute inset-x-0 bottom-6 text-center text-caption uppercase text-dim"
        >
          Листайте, чтобы приблизиться
        </p>

        {/* The headline starts hidden for the scrub to reveal. Without JS
            nothing would ever reveal it, so it stays visible instead. */}
        <noscript>
          <style>{`.hero-content{opacity:1 !important}`}</style>
        </noscript>
      </div>
    </section>
  );
}
