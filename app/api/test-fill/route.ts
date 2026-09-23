import { getServiceSupabase } from "@/lib/supabase/server";
import {
  allocatePiece,
  getGameById,
  getOrCreateActiveGame,
} from "@/services/game";
import { isAdminRequest, adminRequiredResponse } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

/**
 * Developer test mode: fills the next empty piece with a generated test photo
 * so the full completion animation can be exercised without a phone.
 */
export async function POST(request: Request) {
  if (!isAdminRequest(request)) return adminRequiredResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const supabase = getServiceSupabase();

    const game = body?.gameId
      ? await getGameById(supabase, String(body.gameId))
      : await getOrCreateActiveGame(supabase);

    if (!game) {
      return Response.json({ error: "Không tìm thấy game." }, { status: 404 });
    }

    const nextNumber = Math.min(
      game.completed_pieces + 1,
      game.total_pieces,
    );
    const testUrl = `/api/test-image?n=${nextNumber}`;

    const result = await allocatePiece(supabase, game.id, testUrl, null);

    return Response.json({
      pieceIndex: result.pieceIndex,
      completedPieces: result.completedPieces,
      totalPieces: result.totalPieces,
      status: result.status,
      imageUrl: result.imageUrl || testUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("NO_EMPTY_PIECE")) {
      return Response.json(
        { error: "Đại bàng đã đủ mảnh ghép.", code: "GAME_FULL" },
        { status: 409 },
      );
    }
    if (message.includes("GAME_ALREADY_COMPLETED")) {
      return Response.json(
        { error: "Đại bàng đã hoàn thành.", code: "GAME_COMPLETED" },
        { status: 409 },
      );
    }
    console.error("POST /api/test-fill failed", error);
    return Response.json(
      { error: "Không thể test-fill. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
