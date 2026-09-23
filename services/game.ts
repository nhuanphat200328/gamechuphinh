import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game, GameStatus, PuzzlePiece, UploadResult } from "@/lib/types";
import { DEFAULT_TOTAL_PIECES, DEMO_IMAGE_URL } from "@/lib/config";

export async function getGameById(
  supabase: SupabaseClient,
  gameId: string,
): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();

  if (error) throw error;
  return (data as Game) ?? null;
}

export async function getLatestGame(
  supabase: SupabaseClient,
): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as Game) ?? null;
}

export async function getPieces(
  supabase: SupabaseClient,
  gameId: string,
): Promise<PuzzlePiece[]> {
  const { data, error } = await supabase
    .from("puzzle_pieces")
    .select("*")
    .eq("game_id", gameId)
    .order("piece_index", { ascending: true });

  if (error) throw error;
  return (data as PuzzlePiece[]) ?? [];
}

/**
 * Returns the most recent game, creating a fresh one when none exists yet.
 * This keeps `/screen` and `/capture` working out of the box.
 */
export async function getOrCreateActiveGame(
  supabase: SupabaseClient,
): Promise<Game> {
  const existing = await getLatestGame(supabase);
  if (existing) return existing;
  return createGame(supabase, DEFAULT_TOTAL_PIECES);
}

export async function createGame(
  supabase: SupabaseClient,
  totalPieces: number = DEFAULT_TOTAL_PIECES,
): Promise<Game> {
  const { data, error } = await supabase.rpc("new_game", {
    p_total_pieces: totalPieces,
    p_demo_url: DEMO_IMAGE_URL,
  });

  if (error) throw error;

  const gameId = data as string;
  const game = await getGameById(supabase, gameId);
  if (!game) throw new Error("Failed to load the newly created game");
  return game;
}

export async function resetGame(
  supabase: SupabaseClient,
  gameId: string,
): Promise<void> {
  const { error } = await supabase.rpc("reset_game", { p_game_id: gameId });
  if (error) throw error;
}

/**
 * Atomically assigns the next empty piece to an uploaded photo.
 * The heavy lifting (row locking, idempotency, counters) lives in Postgres.
 */
export async function allocatePiece(
  supabase: SupabaseClient,
  gameId: string,
  imageUrl: string,
  clientRef: string | null,
): Promise<UploadResult> {
  const { data, error } = await supabase.rpc("allocate_piece", {
    p_game_id: gameId,
    p_image_url: imageUrl,
    p_client_ref: clientRef,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Piece allocation returned no row");

  return {
    pieceIndex: row.piece_index as number,
    completedPieces: row.completed_pieces as number,
    totalPieces: row.total_pieces as number,
    status: row.status as GameStatus,
    imageUrl: row.image_url as string,
  };
}

export async function getUploadByClientRef(
  supabase: SupabaseClient,
  gameId: string,
  clientRef: string,
): Promise<{ piece_index: number; image_url: string } | null> {
  const { data, error } = await supabase
    .from("uploads")
    .select("piece_index, image_url")
    .eq("game_id", gameId)
    .eq("client_ref", clientRef)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
