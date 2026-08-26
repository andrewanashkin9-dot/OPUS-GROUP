/**
 * Static film grain over the whole viewport.
 *
 * Server-rendered and inert: no state, no listeners, no scripting. Everything
 * that makes it work — the noise itself, the blend mode, the opacity — is in
 * the `.grain` rule in globals.css, so this is only the element the rule needs
 * to exist on.
 */
export function FilmGrain() {
  return <div className="grain" aria-hidden="true" />;
}
