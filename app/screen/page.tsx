"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EaglePuzzle } from "@/components/game/EaglePuzzle";
import { QrPanel } from "@/components/game/QrPanel";
import { useGameState } from "@/hooks/useGameState";
import { resolveSiteUrl } from "@/lib/config";

type Phase = "playing" | "celebrate" | "flying" | "done";

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

  // --- Completion animation state machine --------------------------------
  const prevCompleteRef = useRef(false);

  useEffect(() => {
    if (isComplete && !prevCompleteRef.current) {
      setPhase("celebrate");
    } else if (!isComplete && prevCompleteRef.current) {
      setPhase("playing");
      setHighlight(null);
    }
    prevCompleteRef.current = isComplete;
  }, [isComplete]);

  useEffect(() => {
    if (phase === "celebrate") {
      // Hold the finished eagle long enough to be appreciated.
      const timer = setTimeout(() => setPhase("flying"), 2200);
      return () => clearTimeout(timer);
    }
    if (phase === "flying") {
      // Matches the 12s `eagle-flight` keyframe timeline in globals.css.
      const timer = setTimeout(() => setPhase("done"), 12000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const showCompletionText = phase !== "playing";

  return (
    <main className="screen-root text-[var(--ink)]">
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
          <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
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
                  celebrating={phase === "celebrate"}
                  flying={phase === "flying"}
                />
              )}
            </div>

            {showCompletionText ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="completion-title text-center text-[clamp(1.4rem,4vw,4.5rem)] leading-none font-black tracking-[0.08em] text-[var(--gold-2)] text-glow-gold">
                  ĐẠI BÀNG ĐÃ TUNG CÁNH
                </p>
                {phase === "done" ? (
                  <p className="mt-4 text-[clamp(0.7rem,1.1vw,1.1rem)] tracking-[0.3em] text-[var(--muted)] uppercase">
                    Hoàn thành · Mở /admin để bắt đầu lượt mới
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* QR side panel */}
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
    </main>
  );
}
