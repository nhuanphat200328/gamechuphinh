"use client";

import { useMemo } from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  EAGLE_PIECES,
} from "@/lib/eagle-geometry";
import { EAGLE_BASE_IMAGE, EAGLE_FLYING_IMAGE } from "@/lib/config";
import { EAGLE_SILHOUETTE_PATH } from "@/lib/eagle-silhouette";
import type { PuzzlePiece as PuzzlePieceModel } from "@/lib/types";
import { PuzzlePiece } from "./PuzzlePiece";

interface EaglePuzzleProps {
  pieces: PuzzlePieceModel[];
  totalPieces: number;
  highlighted: number | null;
  celebrating: boolean;
  flying: boolean;
  /** When true the eagle has switched to the spread-wing flying artwork. */
  showFlying: boolean;
}

export function EaglePuzzle({
  pieces,
  totalPieces,
  highlighted,
  celebrating,
  flying,
  showFlying,
}: EaglePuzzleProps) {
  const piecesByIndex = useMemo(() => {
    const map = new Map<number, PuzzlePieceModel>();
    for (const piece of pieces) map.set(piece.piece_index, piece);
    return map;
  }, [pieces]);

  const wrapperClass = [
    "eagle-puzzle",
    celebrating ? "is-celebrating" : "",
    flying ? "is-flying" : "",
    showFlying ? "is-complete" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClass}>
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

        {/* While playing: real perched eagle + the 10 photo pieces. */}
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

        {/* On completion: the spread-wing flying eagle takes over. */}
        <g className="eagle-layer eagle-layer--fly">
          <image
            className="eagle-fly"
            href={EAGLE_FLYING_IMAGE}
            x={0}
            y={0}
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      </svg>
    </div>
  );
}
