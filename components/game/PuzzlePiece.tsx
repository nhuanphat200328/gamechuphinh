"use client";

import { memo } from "react";
import { type BoundingBox, type EaglePiece } from "@/lib/eagle-geometry";
import { useImageSize } from "@/hooks/useImageSize";

/**
 * Vertical focal bias. 0 = top, 0.5 = centre. A value slightly below the centre
 * keeps the main subject (usually in the upper half of a photo) visible while
 * still filling the piece.
 */
const FOCAL_Y = 0.42;

interface PuzzlePieceProps {
  piece: EaglePiece;
  imageUrl: string | null;
  highlight: boolean;
}

interface CoverRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Smallest scale that fully covers `bbox` without distorting the photo, then
 * positioned to keep the subject visible (centred horizontally, slightly above
 * centre vertically). Any excess is cropped by the piece clip.
 */
function coverRect(bbox: BoundingBox, size: { width: number; height: number }): CoverRect {
  const scale = Math.max(bbox.width / size.width, bbox.height / size.height);
  const width = size.width * scale;
  const height = size.height * scale;
  return {
    x: bbox.x + (bbox.width - width) / 2,
    y: bbox.y + (bbox.height - height) * FOCAL_Y,
    width,
    height,
  };
}

/**
 * A single puzzle piece.
 *
 * The piece is a clip region (quadrilateral) intersected with the eagle
 * silhouette, so it always matches the real base artwork exactly. When the
 * player has uploaded a photo it is drawn (minimal cover) inside that region;
 * otherwise the base eagle image underneath shows through.
 */
function PuzzlePieceImpl({ piece, imageUrl, highlight }: PuzzlePieceProps) {
  const { index, path, bbox } = piece;
  const clipId = `clip-piece-${index}`;
  const size = useImageSize(imageUrl);
  const rect = imageUrl && size ? coverRect(bbox, size) : null;

  return (
    <g className={highlight ? "puzzle-piece is-highlighted" : "puzzle-piece"}>
      <defs>
        <clipPath id={clipId}>
          <path d={path} />
        </clipPath>
      </defs>

      {/* Intersect the piece region with the eagle silhouette so a piece is
          always exactly a region of the real base artwork. */}
      <g clipPath="url(#eagle-silhouette)">
        <g clipPath={`url(#${clipId})`}>
          {imageUrl ? (
            rect ? (
              <image
                className="puzzle-piece__photo"
                href={imageUrl}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                preserveAspectRatio="none"
              />
            ) : (
              // Fallback until the intrinsic size is known.
              <image
                className="puzzle-piece__photo"
                href={imageUrl}
                x={bbox.x}
                y={bbox.y}
                width={bbox.width}
                height={bbox.height}
                preserveAspectRatio="xMidYMid slice"
              />
            )
          ) : null}

          <path
            className="puzzle-piece__edge"
            d={path}
            fill="none"
            stroke="#160d02"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeOpacity={0.5}
          />
        </g>
      </g>
    </g>
  );
}

export const PuzzlePiece = memo(PuzzlePieceImpl);
