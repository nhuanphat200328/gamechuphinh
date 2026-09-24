"use client";

import { useMemo } from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  EAGLE_PIECES,
} from "@/lib/eagle-geometry";
import { EAGLE_BASE_IMAGE } from "@/lib/config";
import { EAGLE_SILHOUETTE_PATH } from "@/lib/eagle-silhouette";
import type { PuzzlePiece as PuzzlePieceModel } from "@/lib/types";
import { PuzzlePiece } from "./PuzzlePiece";

interface EaglePuzzleProps {
  pieces: PuzzlePieceModel[];
  totalPieces: number;
  highlighted: number | null;
}

/**
 * The in-play board: the real artwork with the audience photos clipped into
 * each piece. The completion video is handled by the screen page, so this
 * component only renders the board itself.
 */
export function EaglePuzzle({
  pieces,
  totalPieces,
  highlighted,
}: EaglePuzzleProps) {
  const piecesByIndex = useMemo(() => {
    const map = new Map<number, PuzzlePieceModel>();
    for (const piece of pieces) map.set(piece.piece_index, piece);
    return map;
  }, [pieces]);

  return (
    <div className="eagle-puzzle">
      <svg
        className="eagle-puzzle__svg"
        viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Đại bàng ghép ảnh"
        role="img"
      >
        <defs>
          <radialGradient id="eagle-aura" cx="50%" cy="42%" r="62%">
            <stop offset="0" stopColor="#ffcf6b" stopOpacity="0.16" />
            <stop offset="1" stopColor="#ffcf6b" stopOpacity="0" />
          </radialGradient>

          {/* Alpha silhouette of the perched eagle (traced from the base
              artwork), used to shape user photos so every piece stays exactly
              on the eagle. */}
          <clipPath id="eagle-silhouette" clipPathUnits="userSpaceOnUse">
            <path d={EAGLE_SILHOUETTE_PATH} clipRule="evenodd" />
          </clipPath>
        </defs>

        <ellipse
          className="eagle-puzzle__aura"
          cx={BOARD_WIDTH / 2}
          cy={BOARD_HEIGHT * 0.42}
          rx={BOARD_WIDTH * 0.5}
          ry={BOARD_HEIGHT * 0.52}
          fill="url(#eagle-aura)"
        />

        <g className="eagle-layer eagle-layer--perch">
          <image
            className="eagle-base"
            href={EAGLE_BASE_IMAGE}
            x={0}
            y={0}
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            preserveAspectRatio="none"
          />

          {EAGLE_PIECES.filter((piece) => piece.index <= totalPieces).map(
            (piece) => {
              const model = piecesByIndex.get(piece.index);
              const imageUrl =
                model && model.status === "FILLED"
                  ? model.uploaded_image_url
                  : null;
              return (
                <PuzzlePiece
                  key={piece.index}
                  piece={piece}
                  imageUrl={imageUrl}
                  highlight={highlighted === piece.index}
                />
              );
            },
          )}
        </g>
      </svg>
    </div>
  );
}
