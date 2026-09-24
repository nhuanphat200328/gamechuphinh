"use client";

import { EAGLE_FLYING_IMAGE } from "@/lib/config";
import {
  FLY_HEIGHT,
  FLY_LEFT_PIVOT,
  FLY_LEFT_WING,
  FLY_RIGHT_PIVOT,
  FLY_RIGHT_WING,
  FLY_ROOT_RADIUS,
  FLY_WIDTH,
} from "@/lib/eagle-flight.generated";

interface FlyingEagleRigProps {
  /** Unique prefix so multiple rigs on one page never clash on SVG ids. */
  uid: string;
  className?: string;
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

/**
 * The rigged flying eagle: a body (everything minus the wings) plus two wings
 * that flap independently. The wing beat speed follows the `--flap-duration`
 * CSS variable so it can be sped up or slowed down per flight phase.
 *
 * The right wing is drawn first (behind the body) so the beak/head always
 * stays on top of it.
 */
export function FlyingEagleRig({ uid, className }: FlyingEagleRigProps) {
  const leftOrigin = `${pct(FLY_LEFT_PIVOT[0], FLY_WIDTH)} ${pct(FLY_LEFT_PIVOT[1], FLY_HEIGHT)}`;
  const rightOrigin = `${pct(FLY_RIGHT_PIVOT[0], FLY_WIDTH)} ${pct(FLY_RIGHT_PIVOT[1], FLY_HEIGHT)}`;

  return (
    <svg
      className={className ? `flying-eagle ${className}` : "flying-eagle"}
      viewBox={`0 0 ${FLY_WIDTH} ${FLY_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Đại bàng bay"
    >
      <defs>
        <clipPath id={`${uid}-wing-left`} clipPathUnits="userSpaceOnUse">
          <path d={FLY_LEFT_WING} />
        </clipPath>
        <clipPath id={`${uid}-wing-right`} clipPathUnits="userSpaceOnUse">
          <path d={FLY_RIGHT_WING} />
        </clipPath>
        <mask
          id={`${uid}-body`}
          maskUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={FLY_WIDTH}
          height={FLY_HEIGHT}
        >
          <rect x={0} y={0} width={FLY_WIDTH} height={FLY_HEIGHT} fill="#fff" />
          <path d={FLY_LEFT_WING} fill="#000" />
          <path d={FLY_RIGHT_WING} fill="#000" />
          <circle
            cx={FLY_LEFT_PIVOT[0]}
            cy={FLY_LEFT_PIVOT[1]}
            r={FLY_ROOT_RADIUS}
            fill="#fff"
          />
          <circle
            cx={FLY_RIGHT_PIVOT[0]}
            cy={FLY_RIGHT_PIVOT[1]}
            r={FLY_ROOT_RADIUS}
            fill="#fff"
          />
        </mask>
      </defs>

      <g className="fly-rig">
        <g
          className="fly-wing fly-wing--right"
          style={{ transformBox: "fill-box", transformOrigin: rightOrigin }}
        >
          <g clipPath={`url(#${uid}-wing-right)`}>
            <image
              href={EAGLE_FLYING_IMAGE}
              x={0}
              y={0}
              width={FLY_WIDTH}
              height={FLY_HEIGHT}
            />
          </g>
        </g>

        <image
          className="fly-body"
          href={EAGLE_FLYING_IMAGE}
          x={0}
          y={0}
          width={FLY_WIDTH}
          height={FLY_HEIGHT}
          mask={`url(#${uid}-body)`}
        />

        <g
          className="fly-wing fly-wing--left"
          style={{ transformBox: "fill-box", transformOrigin: leftOrigin }}
        >
          <g clipPath={`url(#${uid}-wing-left)`}>
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
    </svg>
  );
}
