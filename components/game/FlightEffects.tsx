"use client";

import { useMemo } from "react";

interface FlightEffectsProps {
  /** When false nothing is rendered (effects only run during the flight). */
  active: boolean;
}

interface Particle {
  left: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  rotation: number;
}

function randomParticles(count: number, sizeMin: number, sizeMax: number): Particle[] {
  return Array.from({ length: count }, () => ({
    left: 28 + Math.random() * 44,
    delay: Math.random() * 1.4,
    duration: 0.9 + Math.random() * 1.6,
    size: sizeMin + Math.random() * (sizeMax - sizeMin),
    drift: (Math.random() * 2 - 1) * 70,
    rotation: 180 + Math.random() * 420,
  }));
}

/**
 * Purely decorative overlay shown while the eagle takes off: drifting
 * feathers, dust puffs at the feet and vertical speed lines.
 */
export function FlightEffects({ active }: FlightEffectsProps) {
  const feathers = useMemo(() => randomParticles(7, 10, 20), []);
  const dust = useMemo(() => randomParticles(10, 6, 20), []);
  const lines = useMemo(() => randomParticles(8, 40, 150), []);

  if (!active) return null;

  return (
    <div className="fly-fx" aria-hidden>
      {feathers.map((p, i) => (
        <span
          key={`feather-${i}`}
          className="feather"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 1.8,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration + 1.6}s`,
              "--drift": `${p.drift}px`,
              "--rot": `${p.rotation}deg`,
            } as React.CSSProperties
          }
        />
      ))}
      {dust.map((p, i) => (
        <span
          key={`dust-${i}`}
          className="dust"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay * 0.4}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      {lines.map((p, i) => (
        <span
          key={`line-${i}`}
          className="speedline"
          style={{
            left: `${p.left}%`,
            height: p.size,
            animationDelay: `${p.delay * 0.5}s`,
            animationDuration: `${p.duration * 0.7}s`,
          }}
        />
      ))}
    </div>
  );
}
