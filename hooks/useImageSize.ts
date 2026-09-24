"use client";

import { useEffect, useState } from "react";

export interface ImageSize {
  width: number;
  height: number;
}

const sizeCache = new Map<string, ImageSize>();

/**
 * Returns the intrinsic pixel size of an image URL (cached). Used to compute a
 * minimal "cover" crop for each puzzle piece without distorting the photo.
 * Resolves to null until the image has loaded (or if it fails).
 */
export function useImageSize(url: string | null | undefined): ImageSize | null {
  const [size, setSize] = useState<ImageSize | null>(() =>
    url ? (sizeCache.get(url) ?? null) : null,
  );

  useEffect(() => {
    if (!url) {
      setSize(null);
      return;
    }

    const cached = sizeCache.get(url);
    if (cached) {
      setSize(cached);
      return;
    }

    let active = true;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        const next = { width: image.naturalWidth, height: image.naturalHeight };
        sizeCache.set(url, next);
        if (active) setSize(next);
      }
    };
    image.onerror = () => {
      if (active) setSize(null);
    };
    image.src = url;

    return () => {
      active = false;
    };
  }, [url]);

  return size;
}
