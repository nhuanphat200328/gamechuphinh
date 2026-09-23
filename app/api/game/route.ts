import { getServiceSupabase } from "@/lib/supabase/server";
import {
  createGame,
  getOrCreateActiveGame,
  getPieces,
} from "@/services/game";
import { DEFAULT_TOTAL_PIECES } from "@/lib/config";
import { isAdminRequest, adminRequiredResponse } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const game = await getOrCreateActiveGame(supabase);
    const pieces = await getPieces(supabase, game.id);
    return Response.json({ game, pieces });
  } catch (error) {
    console.error("GET /api/game failed", error);
    return Response.json(
      { error: "Không thể tải trạng thái game." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return adminRequiredResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const totalPieces =
      Number(body?.totalPieces) > 0
        ? Math.min(Number(body.totalPieces), 64)
        : DEFAULT_TOTAL_PIECES;

    const supabase = getServiceSupabase();
    const game = await createGame(supabase, totalPieces);
    const pieces = await getPieces(supabase, game.id);
    return Response.json({ game, pieces }, { status: 201 });
  } catch (error) {
    console.error("POST /api/game failed", error);
    return Response.json(
      { error: "Không thể tạo game mới." },
      { status: 500 },
    );
  }
}
