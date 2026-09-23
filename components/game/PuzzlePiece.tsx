"use client";

import { memo } from "react";
import type { EaglePiece } from "@/lib/eagle-geometry";

interface PuzzlePieceProps {
  piece: EaglePiece;
  imageUrl: string | null;
  highlight: boolean;
}

function PuzzlePieceImpl({ piece, imageUrl, highlight }: PuzzlePieceProps) {
  const { index, pointsAttr, bbox, demoFrom, demoTo } = piece;
  const clipId = `clip-piece-${index}`;
  const gradientId = `demo-piece-${index}`;

  return (
    <g className={highlight ? "puzzle-piece is-highlighted" : "puzzle-piece"}>
      <defs>
        <clipPath id={clipId}>
          <polygon points={pointsAttr} />
        </clipPath>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={demoFrom} />
          <stop offset="1" stopColor={demoTo} />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <polygon
          points={pointsAttr}
          fill={`url(#${gradientId})`}
          stroke="#160d02"
          strokeWidth={3}
          strokeLinejoin="round"
        />

        {/* Demo-only face markings on the two head facets. They sit under the
            photo, so they vanish as soon as the piece is filled. */}
        {!imageUrl && (index === 1 || index === 2) ? (
          <g className="puzzle-piece__marks">
            <polygon
              points="486,120 500,150 514,120"
              fill="#e0a63a"
              stroke="#2a1a06"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <circle cx={index === 1 ? 478 : 522} cy={70} r={7} fill="#1b1206" />
            <circle
              cx={index === 1 ? 480 : 520}
              cy={68}
              r={2.4}
              fill="#fff3cf"
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

      <polygon
        className="puzzle-piece__edge"
        points={pointsAttr}
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
