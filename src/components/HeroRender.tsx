/**
 * The hero's subject: an architectural render of a house on a blueprint plane.
 *
 * Framed as a plate rather than floated on the page. That matters here: the
 * render carries its own ruling in perspective, and laid straight onto the
 * sheet it would argue with the page's flat, viewport-fixed grid. Inside a
 * plate — hairline edge, radius, the same stacked shadow every other object
 * gets — it reads as a drawing lying on the paper, and its internal grid
 * belongs to that drawing instead of competing with the one underneath.
 *
 * WebP at both densities with a JPEG fallback, per the image rule; no alpha is
 * needed because the frame, not a cutout, is what separates it from the sheet.
 */
export function HeroRender({ className = "" }: { className?: string }) {
  return (
    <figure className={`plate overflow-hidden ${className}`}>
      <picture>
        <source
          type="image/webp"
          srcSet="/assets/hero/house-1x.webp 1x, /assets/hero/house-2x.webp 2x"
        />
        <source
          type="image/jpeg"
          srcSet="/assets/hero/house-1x.jpg 1x, /assets/hero/house-2x.jpg 2x"
        />
        {/* Plain <img>: pre-rendered at both densities in both formats and
            served with year-long immutable caching, so the optimiser would
            only add a hop in front of a file that is ready to send. */}
        <img
          src="/assets/hero/house-1x.jpg"
          width={700}
          height={467}
          alt="Двухэтажный дом с двускатной крышей на чертёжной плоскости — так выглядит модель, собранная из четырёх фотографий"
          decoding="async"
          className="block h-full w-full object-cover"
        />
      </picture>
    </figure>
  );
}
