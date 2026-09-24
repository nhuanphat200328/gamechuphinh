"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EaglePuzzle } from "@/components/game/EaglePuzzle";
import { QrPanel } from "@/components/game/QrPanel";
import { useGameState } from "@/hooks/useGameState";
import { EAGLE_FLYING_VIDEO, resolveSiteUrl } from "@/lib/config";

type Phase = "playing" | "flight" | "returning" | "done";

export default function ScreenPage() {
  const { game, pieces, connected, loading, error } = useGameState();

  const [origin, setOrigin] = useState("");
  const [phase, setPhase] = useState<Phase>("playing");
  const [highlight, setHighlight] = useState<number | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const total = game?.total_pieces ?? 0;
  const completed = game?.completed_pieces ?? 0;
  const isComplete =
    (game?.status === "COMPLETED" || (total > 0 && completed >= total)) &&
    total > 0;

  const captureUrl = useMemo(() => {
    if (!game) return "";
    const base = resolveSiteUrl(origin);
    return `${base}/capture?game=${game.id}`;
  }, [game, origin]);

  // --- Highlight the most recently filled piece ---------------------------
  const knownFilledRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);

  useEffect(() => {
    const filled = pieces.filter((piece) => piece.status === "FILLED");
    const filledIds = new Set(filled.map((piece) => piece.id));

    if (!seededRef.current) {
      seededRef.current = true;
      knownFilledRef.current = filledIds;
      return;
    }

    const newlyFilled = filled.find(
      (piece) => !knownFilledRef.current.has(piece.id),
    );
    knownFilledRef.current = filledIds;

    if (newlyFilled) {
      setHighlight(newlyFilled.piece_index);
      const timer = setTimeout(() => {
        setHighlight((current) =>
          current === newlyFilled.piece_index ? null : current,
        );
      }, 1900);
      return () => clearTimeout(timer);
    }
  }, [pieces]);

  // --- Completion: play the video, then flash back to the game KV ---------
  const prevCompleteRef = useRef(false);

  useEffect(() => {
    if (isComplete && !prevCompleteRef.current) {
      setPhase("flight");
    } else if (!isComplete && prevCompleteRef.current) {
      setPhase("playing");
      setHighlight(null);
    }
    prevCompleteRef.current = isComplete;
  }, [isComplete]);

  // The moment the video ends, start the flash + crossfade back to the KV.
  const handleVideoEnded = () => setPhase("returning");

  // The flash + crossfade takes ~0.9s; afterwards the KV is shown for good.
  useEffect(() => {
    if (phase !== "returning") return;
    const timer = window.setTimeout(() => setPhase("done"), 900);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <main
      className={`screen-root text-[var(--ink)] ${phase === "flight" ? "is-flight" : ""}`}
    >
      <div className="screen-grid" />

      <div className="relative z-10 flex h-full w-full flex-col px-[clamp(1rem,2.5vw,3rem)] py-[clamp(0.75rem,2vh,2rem)]">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-4">
          <div>
            <p className="screen-title text-[clamp(0.55rem,0.8vw,0.8rem)] font-medium">
              Eagle Wings · Live Mosaic
            </p>
            <h1 className="mt-1 text-[clamp(1.2rem,2.6vw,2.6rem)] leading-none font-black tracking-tight">
              GHÉP ẢNH ĐẠI BÀNG
            </h1>
          </div>

          <div className="badge flex items-center gap-2 rounded-full px-3 py-1.5">
            <span
              className={`connection-dot ${connected ? "" : "is-off"}`}
              aria-hidden
            />
            <span className="text-[0.62rem] tracking-[0.2em] text-[var(--muted)] uppercase">
              {connected ? "Realtime" : "Đang kết nối lại"}
            </span>
          </div>
        </header>

        {/* Main stage */}
        <section className="mt-[clamp(0.5rem,1.5vh,1.5rem)] flex min-h-0 flex-1 items-center gap-[clamp(1rem,3vw,3rem)]">
          <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center self-stretch">
            <div className="h-full w-full">
              {loading && !game ? (
                <div className="flex h-full w-full items-center justify-center text-[var(--muted)]">
                  Đang tải...
                </div>
              ) : (
                <EaglePuzzle
                  pieces={pieces}
                  totalPieces={total}
                  highlighted={highlight}
                />
              )}
            </div>
          </div>

          {/* QR side panel (hidden while the video plays) */}
          <aside className="flex w-[clamp(180px,20vw,360px)] shrink-0 flex-col items-center justify-center">
            {captureUrl ? (
              <QrPanel url={captureUrl} completed={completed} total={total} />
            ) : null}
          </aside>
        </section>

        {/* Footer / progress */}
        <footer className="mt-[clamp(0.5rem,1.5vh,1.25rem)] shrink-0">
          <div className="flex items-center gap-4">
            <div className="progress-track h-[10px] flex-1 overflow-hidden rounded-full">
              <div
                className="progress-fill h-full rounded-full"
                style={{
                  width: total > 0 ? `${(completed / total) * 100}%` : "0%",
                }}
              />
            </div>
            <p className="w-[clamp(3.5rem,6vw,6rem)] text-right text-[clamp(0.9rem,1.6vw,1.6rem)] font-bold text-[var(--gold-2)]">
              {completed}/{total}
            </p>
          </div>

          {error ? (
            <p className="mt-2 text-center text-xs text-[var(--muted)]">
              {error} · Đang giữ trạng thái gần nhất và tự kết nối lại.
            </p>
          ) : null}
        </footer>
      </div>

      {/* Completion video: full-screen, plays once and holds the last frame.
          After a short beat it flashes and crossfades back to the game KV. */}
      {phase === "flight" || phase === "returning" ? (
        <video
          className={`flight-video ${phase === "returning" ? "is-out" : ""}`}
          src={EAGLE_FLYING_VIDEO}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={handleVideoEnded}
        />
      ) : null}

      {/* Light golden flash at the instant the tenth piece lands, handing off
          to the video. Plays once; fades out on its own. */}
      {phase === "flight" ? <div className="intro-flash" aria-hidden /> : null}

      {phase === "returning" ? <div className="return-flash" aria-hidden /> : null}
    </main>
  );
}
