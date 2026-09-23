"use client";

import { useMemo } from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  EAGLE_PIECES,
} from "@/lib/eagle-geometry";
import type { PuzzlePiece as PuzzlePieceModel } from "@/lib/types";
import { PuzzlePiece } from "./PuzzlePiece";

interface EaglePuzzleProps {
  pieces: PuzzlePieceModel[];
  totalPieces: number;
  highlighted: number | null;
  celebrating: boolean;
  flying: boolean;
  className?: string;
}

export function EaglePuzzle({
  pieces,
  totalPieces,
  highlighted,
  celebrating,
  flying,
  className = "",
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
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClass}>
      <svg
        className="eagle-puzzle__svg"
        viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Đại bàng phân mảnh"
        role="img"
      >
        <defs>
          <radialGradient id="eagle-aura" cx="50%" cy="38%" r="65%">
            <stop offset="0" stopColor="#ffcf6b" stopOpacity="0.22" />
            <stop offset="1" stopColor="#ffcf6b" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse
          className="eagle-puzzle__aura"
          cx={BOARD_WIDTH / 2}
          cy={BOARD_HEIGHT * 0.42}
          rx={BOARD_WIDTH * 0.5}
          ry={BOARD_HEIGHT * 0.52}
          fill="url(#eagle-aura)"
        />

        <ellipse
          className="eagle-puzzle__shadow"
          cx={500}
          cy={934}
          rx={232}
          ry={26}
          fill="#000000"
          opacity={0.28}
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
      </svg>
    </div>
  );
}
