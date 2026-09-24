"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { EAGLE_FLYING_IMAGE } from "@/lib/config";
import { FlyingEagleRig } from "./FlyingEagleRig";

interface FlightStageProps {
  active: boolean;
  /** Element whose centre the eagle starts from (the puzzle board). */
  originRef?: RefObject<HTMLElement | null>;
  /** Called once the whole choreography has played out. */
  onFinished?: () => void;
}

// Choreography timeline (ms).
const SPREAD_END = 2000;
const TAKEOFF_END = 3800;
const LOOP1_END = 7300;
const LOOP2_END = 12300;
const AWAY_END = 14600;
const TOTAL = AWAY_END;

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeIn = (t: number) => t * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

interface FlightState {
  x: number;
  y: number;
  scale: number;
  bank: number;
  flap: number;
  speed: number;
  rays: number;
  vignette: number;
  flare: number;
  opacity: number;
}

export function FlightStage({ active, originRef, onFinished }: FlightStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const flyerRef = useRef<HTMLDivElement | null>(null);
  const raysRef = useRef<HTMLDivElement | null>(null);
  const flareRef = useRef<HTMLDivElement | null>(null);
  const vignetteRef = useRef<HTMLDivElement | null>(null);
  const linesRef = useRef<HTMLDivElement | null>(null);
  const particleRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const ghostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const finishedRef = useRef(false);

  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        radius: 34 + (i % 5) * 22,
        angle: (i / 14) * TAU,
        size: 3 + ((i * 7) % 6),
        spin: 0.0004 + (i % 4) * 0.0002,
      })),
    [],
  );

  useEffect(() => {
    if (!active) return;
    const stage = stageRef.current;
    if (!stage) return;

    finishedRef.current = false;
    const history: FlightState[] = [];
    let raf = 0;
    let start = 0;
    let vw = window.innerWidth;
    let vh = window.innerHeight;
    let base = 0;
    let rx = 0;
    let ry = 0;
    let startX = vw / 2;
    let startY = vh / 2;

    const layout = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      base = Math.min(vw, vh) * 0.62;
      rx = vw * 0.33;
      ry = vh * 0.3;
      stage.style.setProperty("--flyer-size", `${base}px`);
      const rect = originRef?.current?.getBoundingClientRect();
      startX = rect ? rect.left + rect.width / 2 : vw / 2;
      startY = rect ? rect.top + rect.height / 2 : vh / 2;
    };
    layout();
    window.addEventListener("resize", layout);

    const orbit = (angle: number) => ({
      x: vw / 2 + rx * Math.cos(angle),
      y: vh / 2 + ry * Math.sin(angle),
    });

    const stateAt = (t: number): FlightState => {
      const theta0 = Math.PI;
      if (t < SPREAD_END) {
        const p = clamp01(t / SPREAD_END);
        return {
          x: startX,
          y: startY,
          scale: lerp(0.92, 1, p),
          bank: 0,
          flap: 1.5,
          speed: 0,
          rays: 0.8 * Math.min(1, p * 1.6),
          vignette: 0.5 * p,
          flare: 0,
          opacity: Math.min(1, t / 450),
        };
      }
      if (t < TAKEOFF_END) {
        const p = clamp01((t - SPREAD_END) / (TAKEOFF_END - SPREAD_END));
        const e = easeIn(p);
        const target = orbit(theta0);
        return {
          x: lerp(startX, target.x, e),
          y: lerp(startY, target.y, e) - 50 * e,
          scale: 1,
          bank: 0,
          flap: lerp(1.5, 0.6, p),
          speed: 0.65 * p,
          rays: 0.8 * (1 - p),
          vignette: 0.5 + 0.1 * p,
          flare: 0.35 * p,
          opacity: 1,
        };
      }
      if (t < LOOP1_END) {
        const p = clamp01((t - TAKEOFF_END) / (LOOP1_END - TAKEOFF_END));
        const o = orbit(theta0 + TAU * easeInOut(p));
        return {
          x: o.x,
          y: o.y,
          scale: lerp(1, 0.5, p),
          bank: 10 * easeOut(Math.min(1, p * 4)),
          flap: 0.55,
          speed: 1,
          rays: 0,
          vignette: 0.6,
          flare: 0.5 + 0.5 * Math.sin(t / 210),
          opacity: 1,
        };
      }
      if (t < LOOP2_END) {
        const p = clamp01((t - LOOP1_END) / (LOOP2_END - LOOP1_END));
        const o = orbit(theta0 + TAU + TAU * easeInOut(p));
        return {
          x: o.x,
          y: o.y,
          scale: lerp(0.5, 1.05, p),
          bank: 10 * (1 - easeInOut(p)),
          flap: lerp(0.55, 1.25, p),
          speed: lerp(0.75, 0.3, p),
          rays: 0,
          vignette: 0.6,
          flare: 0.3 + 0.2 * Math.sin(t / 250),
          opacity: 1,
        };
      }
      const p = clamp01((t - LOOP2_END) / (AWAY_END - LOOP2_END));
      const e = easeIn(p);
      const from = orbit(theta0);
      return {
        x: from.x + vw * 0.45 * e,
        y: from.y - vh * 1.3 * e,
        scale: lerp(1.05, 1.5, e),
        bank: -12 * e,
        flap: 0.5,
        speed: 1,
        rays: 0,
        vignette: 0.6 * (1 - e),
        flare: 0.6 * (1 - e),
        opacity: 1 - e,
      };
    };

    const apply = (s: FlightState) => {
      const flyer = flyerRef.current;
      if (flyer) {
        flyer.style.transform = `translate(${s.x - base / 2}px, ${s.y - base / 2}px) scale(${s.scale}) rotate(${s.bank}deg)`;
        flyer.style.opacity = `${s.opacity}`;
        flyer.style.setProperty("--flap-duration", `${s.flap}s`);
      }
      if (raysRef.current) {
        raysRef.current.style.transform = `translate(${s.x}px, ${s.y}px)`;
        raysRef.current.style.opacity = `${s.rays}`;
      }
      if (flareRef.current) {
        flareRef.current.style.transform = `translate(${s.x}px, ${s.y}px)`;
        flareRef.current.style.opacity = `${s.flare * 0.8}`;
      }
      if (vignetteRef.current) {
        vignetteRef.current.style.opacity = `${s.vignette}`;
      }
      if (linesRef.current) {
        linesRef.current.style.opacity = `${s.speed}`;
      }
    };

    const loop = (now: number) => {
      if (!start) start = now;
      const t = now - start;
      const s = stateAt(t);
      apply(s);

      history.push(s);
      if (history.length > 40) history.shift();

      ghostRefs.current.forEach((g, i) => {
        if (!g) return;
        const back = 4 + i * 4;
        const h = history[history.length - 1 - back];
        if (!h) {
          g.style.opacity = "0";
          return;
        }
        g.style.transform = `translate(${h.x - base / 2}px, ${h.y - base / 2}px) scale(${h.scale}) rotate(${h.bank}deg)`;
        g.style.opacity = `${(0.22 - i * 0.06) * h.opacity * clamp01(h.speed + 0.15)}`;
      });

      particleRefs.current.forEach((p, i) => {
        if (!p) return;
        const cfg = particles[i];
        const a = cfg.angle + t * cfg.spin;
        const px = s.x + Math.cos(a) * cfg.radius * s.scale;
        const py = s.y + Math.sin(a) * cfg.radius * s.scale * 0.7;
        p.style.transform = `translate(${px}px, ${py}px)`;
        p.style.opacity = `${s.speed * 0.85 * s.opacity}`;
      });

      if (t >= TOTAL) {
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinished?.();
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", layout);
    };
  }, [active, onFinished, originRef, particles]);

  return (
    <div
      ref={stageRef}
      className={`flight-stage ${active ? "is-active" : ""}`}
      aria-hidden
    >
      <div ref={vignetteRef} className="flight-vignette" />
      <div ref={raysRef} className="flight-rays" />
      <div className="flight-ghosts">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            ref={(el) => {
              ghostRefs.current[i] = el;
            }}
            className="flight-ghost"
            style={{ backgroundImage: `url(${EAGLE_FLYING_IMAGE})` }}
          />
        ))}
      </div>
      <div ref={linesRef} className="flight-speedlines">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            style={{
              left: `${(i / 12) * 100 + 2}%`,
              animationDelay: `${(i % 5) * 0.12}s`,
              animationDuration: `${0.6 + (i % 4) * 0.15}s`,
            }}
          />
        ))}
      </div>
      <div ref={flareRef} className="flight-flare" />
      <div className="flight-particles">
        {particles.map((p, i) => (
          <span
            key={i}
            ref={(el) => {
              particleRefs.current[i] = el;
            }}
            style={{ width: p.size, height: p.size }}
          />
        ))}
      </div>
      <div ref={flyerRef} className="flight-flyer">
        <FlyingEagleRig uid="flight" className="flight-flyer__eagle" />
      </div>
    </div>
  );
}
