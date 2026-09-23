"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game, PuzzlePiece } from "@/lib/types";

const POLL_MS = 5000;

interface GameResponse {
  game: Game;
  pieces: PuzzlePiece[];
}

export function AdminPanel() {
  const [state, setState] = useState<GameResponse | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalPieces, setTotalPieces] = useState(10);
  const tokenRef = useRef("");

  useEffect(() => {
    const stored = window.localStorage.getItem("admin-token") || "";
    setToken(stored);
    tokenRef.current = stored;
  }, []);

  const authHeaders = useCallback((): HeadersInit => {
    const headers: Record<string, string> = {};
    if (tokenRef.current) headers["x-admin-token"] = tokenRef.current;
    return headers;
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/game", { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      setState((await response.json()) as GameResponse);
      setError(null);
    } catch {
      setError("Không tải được trạng thái game.");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const runAction = useCallback(
    async (key: string, run: () => Promise<Response>) => {
      setBusy(key);
      setMessage(null);
      setError(null);
      try {
        const response = await run();
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Thao tác thất bại.");
        }
        setMessage(
          key === "test"
            ? `Đã ghép mảnh #${payload.pieceIndex} (${payload.completedPieces}/${payload.totalPieces})`
            : key === "reset"
              ? "Đã reset game về trạng thái ban đầu."
              : "Đã tạo game mới.",
        );
        await load();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "Thao tác thất bại.",
        );
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const handleTestFill = useCallback(() => {
    const gameId = state?.game.id;
    void runAction("test", () =>
      fetch("/api/test-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ gameId }),
      }),
    );
  }, [authHeaders, runAction, state?.game.id]);

  const handleReset = useCallback(() => {
    const gameId = state?.game.id;
    if (!gameId) return;
    if (!window.confirm("Reset toàn bộ puzzle về trạng thái ban đầu?")) return;
    void runAction("reset", () =>
      fetch("/api/game/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ gameId }),
      }),
    );
  }, [authHeaders, runAction, state?.game.id]);

  const handleNewGame = useCallback(() => {
    if (!window.confirm("Tạo game mới và bắt đầu lượt chơi mới?")) return;
    void runAction("new", () =>
      fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ totalPieces }),
      }),
    );
  }, [authHeaders, runAction, totalPieces]);

  const game = state?.game;
  const pieces = state?.pieces ?? [];
  const uploaded = pieces.filter((piece) => piece.status === "FILLED");

  return (
    <main className="admin-root mx-auto max-w-5xl px-5 py-8 text-[var(--ink)]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[0.6rem] tracking-[0.3em] text-[var(--gold)] uppercase">
            Eagle Wings
          </p>
          <h1 className="text-2xl font-black">Admin · Quản lý lượt chơi</h1>
        </div>
        <a
          href="/screen"
          className="btn-ghost rounded-full px-4 py-2 text-sm"
          target="_blank"
          rel="noreferrer"
        >
          Mở màn hình LED ↗
        </a>
      </header>

      {message ? (
        <p className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <section className="admin-card mb-6 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-widest text-[var(--muted)] uppercase">
              Game status
            </p>
            <p className="text-xl font-bold text-[var(--gold-2)]">
              {game?.status ?? "—"}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {game?.id ?? "Chưa có game"}
            </p>
          </div>
          <div>
            <p className="text-xs tracking-widest text-[var(--muted)] uppercase">
              Pieces
            </p>
            <p className="text-xl font-bold">
              {game?.completed_pieces ?? 0} / {game?.total_pieces ?? 0}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {pieces.map((piece) => (
            <span
              key={piece.id}
              className={`piece-chip flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold ${
                piece.status === "FILLED" ? "is-filled" : ""
              }`}
              title={
                piece.status === "FILLED" && piece.uploaded_image_url
                  ? piece.uploaded_image_url
                  : "Chưa có ảnh"
              }
            >
              {piece.status === "FILLED" ? "✓" : piece.piece_index}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60"
            onClick={handleTestFill}
            disabled={busy !== null}
          >
            {busy === "test" ? "Đang ghép..." : "TEST FILL NEXT PIECE"}
          </button>
          <button
            type="button"
            className="btn-ghost rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60"
            onClick={handleReset}
            disabled={busy !== null}
          >
            {busy === "reset" ? "Đang reset..." : "RESET GAME"}
          </button>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={64}
              value={totalPieces}
              onChange={(event) =>
                setTotalPieces(Math.max(1, Number(event.target.value) || 1))
              }
              className="w-20 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm"
              aria-label="Số mảnh ghép"
            />
            <button
              type="button"
              className="btn-ghost rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60"
              onClick={handleNewGame}
              disabled={busy !== null}
            >
              {busy === "new" ? "Đang tạo..." : "GAME MỚI"}
            </button>
          </div>
        </div>
      </section>

      <section className="admin-card rounded-2xl p-5">
        <h2 className="mb-4 text-sm tracking-widest text-[var(--muted)] uppercase">
          Ảnh đã upload ({uploaded.length})
        </h2>
        {uploaded.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Chưa có ảnh nào.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {uploaded.map((piece) => (
              <div
                key={piece.id}
                className="overflow-hidden rounded-xl border border-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={piece.uploaded_image_url ?? ""}
                  alt={`Mảnh ${piece.piece_index}`}
                  className="h-24 w-full object-cover"
                />
                <p className="px-2 py-1 text-center text-xs text-[var(--muted)]">
                  #{piece.piece_index}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-card mt-6 rounded-2xl p-5">
        <h2 className="mb-2 text-sm tracking-widest text-[var(--muted)] uppercase">
          Bảo vệ Admin
        </h2>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Nếu server đặt biến môi trường <code>ADMIN_TOKEN</code>, hãy nhập token
          tại đây. Token chỉ được lưu trong trình duyệt này.
        </p>
        <input
          type="password"
          value={token}
          placeholder="ADMIN_TOKEN (nếu có)"
          onChange={(event) => {
            setToken(event.target.value);
            tokenRef.current = event.target.value;
            window.localStorage.setItem("admin-token", event.target.value);
          }}
          className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm"
        />
      </section>
    </main>
  );
}
