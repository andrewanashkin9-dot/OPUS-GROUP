"use client";

import { useEffect, useRef } from "react";
import { createSurfaceTexture } from "@/lib/3d/textures";
import type { TextureId } from "@/lib/3d/types";

/**
 * Draws the same generated pattern the 3D surface uses, so the swatch in the
 * palette is the actual brick or tile the house will wear rather than a flat
 * colour chip standing in for it.
 */
export function TextureSwatch({
  textureId,
  color,
  size = 44,
  className = "",
}: {
  textureId: TextureId;
  color: string;
  size?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // Reuse the texture pipeline, then paint its source onto the swatch.
    const texture = createSurfaceTexture(textureId, color, 1.6, 1.6);
    const source = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (ctx && source) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(source, 0, 0, size, size);
    }
    texture.dispose();
  }, [textureId, color, size]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`rounded-full border border-line ${className}`}
    />
  );
}
