interface LogoProps {
  className?: string;
}

/**
 * The OPUS GROUP mark: a wireframe shipping container on a crane hook.
 *
 * Drawn as a CSS mask over `currentColor` rather than as an <img>. The mark is
 * single-colour line work, so masking lets one asset serve every context — it
 * takes the accent from whatever it sits in, which means it follows the theme
 * between blue and black paper and will follow the accent colour itself if
 * that changes, with no second file and no per-theme swap.
 *
 * The supplied artwork was a flattened raster with the transparency *painted
 * in* as a checkerboard, so it was keyed to a real alpha channel first: ink
 * above the checker's grey, everything at or below it dropped. Its hairlines
 * average to about 40% coverage when scaled into a 32px box, which next to
 * solid nav type reads as a grey smudge, so the alpha is gained to put the
 * strokes back at full ink while leaving the antialiased tips soft.
 */
export function Logo({ className }: LogoProps) {
  return (
    <span
      role="img"
      aria-label="OPUS GROUP"
      className={`logo-mark inline-block shrink-0 ${className ?? ""}`}
    />
  );
}
