/**
 * The two pre-rendered shots that carry the reader between stages, and the
 * session memory that decides whether either one should play.
 *
 * The rules, in one place because they are easy to get subtly wrong:
 *
 *   - a clip plays at most once per session, per transition;
 *   - the clip into the estimate plays only on the move *from* the model to
 *     the estimate, not on any other arrival at that page;
 *   - the file is prefetched while the browser is idle, so the clip that
 *     plays next is already in cache when it is asked for.
 *
 * State lives in sessionStorage rather than the app store: it describes this
 * visit, not the project, and it must not survive into the persisted project
 * or be replayed when a saved project is restored.
 */

export type TransitionId = "design" | "estimate";

export interface ClipSpec {
  src: string;
  poster: string;
  /** Seconds. Used only as the ceiling on how long a stalled clip may hold. */
  durationS: number;
  /** Alt text for the poster in the reduced-motion presentation. */
  alt: string;
}

export const CLIPS: Record<TransitionId, ClipSpec> = {
  design: {
    src: "/assets/clip-a.mp4",
    poster: "/assets/clip-a-poster.jpg",
    durationS: 4.05,
    alt: "Чертёжный стол: линейка и карандаш на плане дома",
  },
  estimate: {
    src: "/assets/clip-b.mp4",
    poster: "/assets/clip-b-poster.jpg",
    durationS: 3.05,
    alt: "Телефон на столе — заказ продолжается на экране",
  },
};

const PLAYED_KEY = "opus-group-clips-played";
const ARMED_KEY = "opus-group-clip-armed";

/** sessionStorage throws outright in some privacy modes; never let it break a page. */
function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function playedSet(): Set<string> {
  const raw = session()?.getItem(PLAYED_KEY);
  return new Set(raw ? raw.split(",") : []);
}

export function hasPlayed(id: TransitionId): boolean {
  if (typeof window === "undefined") return true;
  return playedSet().has(id);
}

export function markPlayed(id: TransitionId): void {
  const store = session();
  if (!store) return;
  const set = playedSet();
  set.add(id);
  try {
    store.setItem(PLAYED_KEY, Array.from(set).join(","));
  } catch {
    // A full or locked store only costs a repeated clip, never correctness.
  }
}

/**
 * Records that the reader is leaving for the stage this clip belongs to.
 * Called from the control that navigates, so arriving at the same page any
 * other way — a bookmark, the nav bar, the back button — shows no clip.
 */
export function armTransition(id: TransitionId): void {
  try {
    session()?.setItem(ARMED_KEY, id);
  } catch {
    /* see markPlayed */
  }
}

/** Reads and clears the arming flag: a single navigation, a single clip. */
export function consumeArmed(id: TransitionId): boolean {
  const store = session();
  if (!store) return false;
  const armed = store.getItem(ARMED_KEY) === id;
  if (armed) {
    try {
      store.removeItem(ARMED_KEY);
    } catch {
      /* see markPlayed */
    }
  }
  return armed;
}

/**
 * Warms the next clip while the browser has nothing else to do. Skipped when
 * the clip has already played (it will never be requested again) and when the
 * reader has asked their browser to save data.
 */
export function preloadClip(id: TransitionId): void {
  if (typeof window === "undefined" || hasPlayed(id)) return;

  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  if (connection?.saveData) return;

  const run = () => {
    // force-cache so the request is served from, and populates, the HTTP
    // cache the <video> element will read from a moment later.
    void fetch(CLIPS[id].src, { cache: "force-cache" }).catch(() => {
      // A failed warm-up is not a failure: the element will fetch it itself.
    });
  };

  const idle = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;

  if (idle) idle(run, { timeout: 4000 });
  else window.setTimeout(run, 1200);
}
