"use client";

import { memo } from "react";
import { BOARD_HEIGHT, BOARD_WIDTH, type EaglePiece } from "@/lib/eagle-geometry";

interface PuzzlePieceProps {
  piece: EaglePiece;
  imageUrl: string | null;
  highlight: boolean;
}

/**
 * A single puzzle piece.
 *
 * The piece is a clip region (quadrilateral) intersected with the eagle
 * silhouette mask, so it always matches the real base artwork exactly. When
 * the player has uploaded a photo it is drawn (cover) inside that region;
 * otherwise the base eagle image underneath shows through.
 */
function PuzzlePieceImpl({ piece, imageUrl, highlight }: PuzzlePieceProps) {
  const { index, path } = piece;
  const clipId = `clip-piece-${index}`;

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
            <image
              className="puzzle-piece__photo"
              href={imageUrl}
              x={0}
              y={0}
              width={BOARD_WIDTH}
              height={BOARD_HEIGHT}
              preserveAspectRatio="xMidYMid slice"
            />
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
