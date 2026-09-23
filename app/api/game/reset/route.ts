import { getServiceSupabase } from "@/lib/supabase/server";
import { getGameById, getPieces, resetGame } from "@/services/game";
import { isAdminRequest, adminRequiredResponse } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return adminRequiredResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const gameId = body?.gameId as string | undefined;

    const supabase = getServiceSupabase();

    let targetId = gameId;
    if (!targetId) {
      const { data } = await supabase
        .from("games")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      targetId = data?.id;
    }

    if (!targetId) {
      return Response.json({ error: "Không tìm thấy game." }, { status: 404 });
    }

    await resetGame(supabase, targetId);
    const game = await getGameById(supabase, targetId);
    const pieces = await getPieces(supabase, targetId);

    return Response.json({ game, pieces });
  } catch (error) {
    console.error("POST /api/game/reset failed", error);
    return Response.json(
      { error: "Không thể reset game." },
      { status: 500 },
    );
  }
}
