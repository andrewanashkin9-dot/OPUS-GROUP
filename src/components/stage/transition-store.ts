import {
  consumeArmed,
  hasPlayed,
  markPlayed,
  type TransitionId,
} from "@/lib/transitions";

/**
 * Which phase each section clip is in, held outside React.
 *
 * A component cannot simply decide in an effect whether to show itself: the
 * React Compiler's lint forbids setting state synchronously from an effect,
 * and reading sessionStorage during render would make the server and the
 * first client render disagree. An external store solves both — the server
 * and the hydrating client both read "idle" from a frozen snapshot, and the
 * decision arrives afterwards as an ordinary store update.
 */

export type Phase = "idle" | "playing" | "leaving";

type State = Record<TransitionId, Phase>;

const IDLE: State = Object.freeze({ design: "idle", estimate: "idle" });

let state: State = IDLE;
const listeners = new Set<() => void>();

/**
 * Transitions already answered for in this session. Kept beside the phase
 * rather than derived from it, so that a clip which has finished — and is
 * back at "idle" — is not started again by a remount, and so that React's
 * development double-effect asks the question once rather than twice.
 */
const decided = new Set<TransitionId>();

function set(id: TransitionId, phase: Phase) {
  if (state[id] === phase) return;
  state = { ...state, [id]: phase };
  for (const listener of listeners) listener();
}

export const transitionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  snapshot(id: TransitionId) {
    return state[id];
  },
  /** The value both the server and the first client render see. */
  serverSnapshot() {
    return "idle" as const;
  },
  /**
   * Asks whether this clip should play, at most once per session. `needsArm`
   * marks a transition that belongs to one specific navigation: it plays only
   * if the control that navigates armed it first.
   */
  request(id: TransitionId, needsArm: boolean) {
    if (decided.has(id)) return;
    decided.add(id);
    if (hasPlayed(id)) return;
    if (needsArm && !consumeArmed(id)) return;
    // Marked before it plays, not after: a clip interrupted halfway has still
    // been seen, and replaying it on the next visit would be worse than
    // dropping it.
    markPlayed(id);
    set(id, "playing");
  },
  leave(id: TransitionId) {
    if (state[id] === "playing") set(id, "leaving");
  },
  end(id: TransitionId) {
    set(id, "idle");
  },
};
