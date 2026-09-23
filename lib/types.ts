export type GameStatus = "WAITING" | "RUNNING" | "COMPLETED" | "RESETTING";
export type PieceStatus = "EMPTY" | "FILLED";

export interface Game {
  id: string;
  status: GameStatus;
  total_pieces: number;
  completed_pieces: number;
  created_at: string;
  updated_at: string;
}

export interface PuzzlePiece {
  id: string;
  game_id: string;
  piece_index: number;
  demo_image_url: string | null;
  uploaded_image_url: string | null;
  status: PieceStatus;
  created_at: string;
  updated_at: string;
}

export interface GameState {
  game: Game | null;
  pieces: PuzzlePiece[];
}

export interface UploadResult {
  pieceIndex: number;
  completedPieces: number;
  totalPieces: number;
  status: GameStatus;
  /** Canonical stored image URL (the one actually attached to the piece). */
  imageUrl: string;
}
