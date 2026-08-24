import { photoSources } from "@/lib/marketplace";

/**
 * A catalogue photograph, in the responsive set the browser can actually
 * choose from: WebP for anything made this decade, JPEG for the rest, each at
 * 1x and 2x.
 *
 * Served straight from /public rather than through next/image on purpose.
 * These are pre-rendered at exactly the two sizes they are displayed at and
 * already encoded in both formats, so the optimiser would have nothing left
 * to decide — it would only add a request to a resizing endpoint in front of
 * a file that is ready to send, and lose the year-long immutable caching
 * these assets are served with.
 */

interface ProductPhotoProps {
  id: string;
  alt: string;
  className?: string;
  /** Above the fold: load it immediately instead of waiting for the viewport. */
  priority?: boolean;
}

const INTRINSIC = { width: 480, height: 360 };

export function ProductPhoto({
  id,
  alt,
  className = "",
  priority = false,
}: ProductPhotoProps) {
  const sources = photoSources(id);

  return (
    <picture>
      <source type="image/webp" srcSet={sources.webp} />
      <source type="image/jpeg" srcSet={sources.jpeg} />
      {/* Plain <img>, deliberately — see the note above. */}
      <img
        src={sources.fallback}
        alt={alt}
        width={INTRINSIC.width}
        height={INTRINSIC.height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
      />
    </picture>
  );
}
