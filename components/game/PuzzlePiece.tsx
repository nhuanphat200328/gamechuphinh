"use client";

import { memo } from "react";
import type { EaglePiece } from "@/lib/eagle-geometry";

interface PuzzlePieceProps {
  piece: EaglePiece;
  imageUrl: string | null;
  highlight: boolean;
}

function PuzzlePieceImpl({ piece, imageUrl, highlight }: PuzzlePieceProps) {
  const { index, path, bbox, demoFrom, demoTo, decor } = piece;
  const clipId = `clip-piece-${index}`;
  const gradientId = `demo-piece-${index}`;

  return (
    <g className={highlight ? "puzzle-piece is-highlighted" : "puzzle-piece"}>
      <defs>
        <clipPath id={clipId}>
          <path d={path} />
        </clipPath>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={demoFrom} />
          <stop offset="1" stopColor={demoTo} />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <path
          d={path}
          fill={`url(#${gradientId})`}
          stroke="#160d02"
          strokeWidth={3}
          strokeLinejoin="round"
        />

        {/* Demo-only eye marking on the head piece. It sits under the photo,
            so it vanishes as soon as the piece is filled. */}
        {!imageUrl && decor === "eye" ? (
          <g className="puzzle-piece__marks">
            <circle cx={636} cy={236} r={15} fill="#141007" />
            <circle cx={642} cy={230} r={4.5} fill="#fff6dc" />
            <path
              d="M606 210 C626 200 652 202 668 216"
              fill="none"
              stroke="#3a2c18"
              strokeWidth={6}
              strokeLinecap="round"
            />
          </g>
        ) : null}

        {imageUrl ? (
          <image
            className="puzzle-piece__photo"
            href={imageUrl}
            x={bbox.x}
            y={bbox.y}
            width={bbox.width}
            height={bbox.height}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : null}
      </g>

      <path
        className="puzzle-piece__edge"
        d={path}
        fill="none"
        stroke="#160d02"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeOpacity={0.55}
      />
    </g>
  );
}

export const PuzzlePiece = memo(PuzzlePieceImpl);
