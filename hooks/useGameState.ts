"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { POLL_INTERVAL_MS } from "@/lib/config";
import type { Game, PuzzlePiece } from "@/lib/types";

export interface UseGameStateResult {
  game: Game | null;
  pieces: PuzzlePiece[];
  connected: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function sortPieces(list: PuzzlePiece[]): PuzzlePiece[] {
  return [...list].sort((a, b) => a.piece_index - b.piece_index);
}

/**
 * Loads the active game and keeps it in sync via Supabase Realtime.
 * Falls back to lightweight polling so the LED screen keeps working even if
 * the realtime socket drops. State is never reset by a reconnect.
 */
export function useGameState(): UseGameStateResult {
  const [game, setGame] = useState<Game | null>(null);
  const [pieces, setPieces] = useState<PuzzlePiece[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cancelledRef = useRef(false);

  const upsertPiece = useCallback((piece: PuzzlePiece) => {
    setPieces((prev) => {
      const index = prev.findIndex((p) => p.id === piece.id);
      if (index === -1) return sortPieces([...prev, piece]);
      const next = [...prev];
      next[index] = piece;
      return sortPieces(next);
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/game", { cache: "no-store" });
      if (!response.ok) throw new Error("bad status");
      const data = (await response.json()) as {
        game: Game;
        pieces: PuzzlePiece[];
      };
      if (cancelledRef.current) return;
      setGame(data.game);
      setPieces(sortPieces(data.pieces));
      setError(null);
      setGameId((prev) => (prev === data.game.id ? prev : data.game.id));
    } catch {
      if (!cancelledRef.current) {
        setError("Không thể kết nối máy chủ.");
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    if (!gameId) return;

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "puzzle_pieces",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          if (payload.new && "id" in payload.new) {
            upsertPiece(payload.new as PuzzlePiece);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          if (payload.new && "id" in payload.new) {
            setGame(payload.new as Game);
          }
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [gameId, upsertPiece]);

  return { game, pieces, connected, loading, error, refresh };
}
