/**
 * The sheet the whole site sits on.
 *
 * Two fixed layers, pinned to the viewport rather than to the document: the
 * paper (a radial that lights the middle and falls to --deep at the edges) and
 * the ruling (graph paper, fine at 28px with a bold line every fifth, masked
 * so it fades out with the light). Scrolling then reads as moving across one
 * continuous sheet instead of a background image sliding past.
 *
 * Server-rendered and inert — no state, no listeners. Everything that makes it
 * work is in the .bp-field / .bp-grid rules in globals.css.
 */
export function BlueprintSpace() {
  return (
    <>
      <div className="bp-field" aria-hidden="true" />
      <div className="bp-grid" aria-hidden="true" />
    </>
  );
}
