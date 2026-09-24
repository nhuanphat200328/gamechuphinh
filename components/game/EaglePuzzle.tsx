"use client";

import { useMemo } from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  EAGLE_PIECES,
} from "@/lib/eagle-geometry";
import { EAGLE_BASE_IMAGE, EAGLE_FLYING_IMAGE } from "@/lib/config";
import { EAGLE_SILHOUETTE_PATH } from "@/lib/eagle-silhouette";
import {
  FLY_HEIGHT,
  FLY_LEFT_PIVOT,
  FLY_LEFT_WING,
  FLY_RIGHT_PIVOT,
  FLY_RIGHT_WING,
  FLY_ROOT_RADIUS,
  FLY_WIDTH,
} from "@/lib/eagle-flight.generated";
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

  // Fit the flying artwork into the board (contain, centred) without distorting.
  const flyFit = useMemo(() => {
    const s = Math.min(BOARD_WIDTH / FLY_WIDTH, BOARD_HEIGHT / FLY_HEIGHT);
    return {
      s,
      x: (BOARD_WIDTH - FLY_WIDTH * s) / 2,
      y: (BOARD_HEIGHT - FLY_HEIGHT * s) / 2,
    };
  }, []);

  const [lp, rp] = [FLY_LEFT_PIVOT, FLY_RIGHT_PIVOT];

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

          {/* Flap rig: the flying eagle is split into a body (everything minus
              the wings) and two independently rotating wings. The white discs
              keep the wing roots in the body so the shoulder never opens up. */}
          <clipPath id="fly-wing-left" clipPathUnits="userSpaceOnUse">
            <path d={FLY_LEFT_WING} />
          </clipPath>
          <clipPath id="fly-wing-right" clipPathUnits="userSpaceOnUse">
            <path d={FLY_RIGHT_WING} />
          </clipPath>
          <mask
            id="fly-body-mask"
            maskUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={FLY_WIDTH}
            height={FLY_HEIGHT}
          >
            <rect x={0} y={0} width={FLY_WIDTH} height={FLY_HEIGHT} fill="#fff" />
            <path d={FLY_LEFT_WING} fill="#000" />
            <path d={FLY_RIGHT_WING} fill="#000" />
            <circle cx={lp[0]} cy={lp[1]} r={FLY_ROOT_RADIUS} fill="#fff" />
            <circle cx={rp[0]} cy={rp[1]} r={FLY_ROOT_RADIUS} fill="#fff" />
          </mask>
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

        {/* On completion: the spread-wing flying eagle takes over and flaps. */}
        <g className="eagle-layer eagle-layer--fly">
          <g transform={`translate(${flyFit.x} ${flyFit.y}) scale(${flyFit.s})`}>
            <g className="eagle-fly-rig">
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; 0 -18; 0 0"
                dur="1.1s"
                repeatCount="indefinite"
                calcMode="spline"
                keyTimes="0;0.5;1"
                keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
              />

              <image
                className="eagle-fly-body"
                href={EAGLE_FLYING_IMAGE}
                x={0}
                y={0}
                width={FLY_WIDTH}
                height={FLY_HEIGHT}
                mask="url(#fly-body-mask)"
              />

              <g className="eagle-fly-wing eagle-fly-wing--left">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values={`16 ${lp[0]} ${lp[1]}; -12 ${lp[0]} ${lp[1]}; 16 ${lp[0]} ${lp[1]}`}
                  dur="1.1s"
                  repeatCount="indefinite"
                  calcMode="spline"
                  keyTimes="0;0.5;1"
                  keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
                />
                <g clipPath="url(#fly-wing-left)">
                  <image
                    href={EAGLE_FLYING_IMAGE}
                    x={0}
                    y={0}
                    width={FLY_WIDTH}
                    height={FLY_HEIGHT}
                  />
                </g>
              </g>

              <g className="eagle-fly-wing eagle-fly-wing--right">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values={`-16 ${rp[0]} ${rp[1]}; 12 ${rp[0]} ${rp[1]}; -16 ${rp[0]} ${rp[1]}`}
                  dur="1.1s"
                  repeatCount="indefinite"
                  calcMode="spline"
                  keyTimes="0;0.5;1"
                  keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
                />
                <g clipPath="url(#fly-wing-right)">
                  <image
                    href={EAGLE_FLYING_IMAGE}
                    x={0}
                    y={0}
                    width={FLY_WIDTH}
                    height={FLY_HEIGHT}
                  />
                </g>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
