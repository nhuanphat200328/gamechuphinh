import { getServiceSupabase } from "@/lib/supabase/server";
import {
  allocatePiece,
  getGameById,
  getOrCreateActiveGame,
  getUploadByClientRef,
} from "@/services/game";
import {
  buildObjectPath,
  removeObject,
  uploadObject,
} from "@/services/storage";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from "@/lib/config";
import type { UploadResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fail(message: string, code: string, status = 400) {
  return Response.json({ error: message, code }, { status });
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const gameIdInput = form.get("gameId");
    const clientRefInput = form.get("clientRef");

    if (!(file instanceof File) || file.size === 0) {
      return fail("Không tìm thấy ảnh để gửi.", "NO_FILE");
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return fail("Ảnh quá lớn. Vui lòng chụp lại.", "FILE_TOO_LARGE", 413);
    }

    const mime = file.type || "image/jpeg";
    if (!ALLOWED_MIME.includes(mime)) {
      return fail("Định dạng ảnh không được hỗ trợ.", "BAD_MIME", 415);
    }

    const supabase = getServiceSupabase();

    const game = gameIdInput
      ? { id: String(gameIdInput) }
      : await getOrCreateActiveGame(supabase);

    const clientRef =
      typeof clientRefInput === "string" && clientRefInput.length > 0
        ? clientRefInput
        : null;

    // Idempotency fast-path: the same submission never uploads twice.
    if (clientRef) {
      const existing = await getUploadByClientRef(supabase, game.id, clientRef);
      if (existing) {
        const existingGame = await getGameById(supabase, game.id);
        return Response.json({
          pieceIndex: existing.piece_index,
          completedPieces: existingGame?.completed_pieces ?? 0,
          totalPieces: existingGame?.total_pieces ?? 0,
          status: existingGame?.status ?? "RUNNING",
          imageUrl: existing.image_url,
        });
      }
    }

    const path = buildObjectPath(game.id, mime);
    const buffer = await file.arrayBuffer();

    const uploaded = await uploadObject(supabase, path, buffer, mime);
    uploadedPath = uploaded.path;

    let result: UploadResult;
    try {
      result = await allocatePiece(
        supabase,
        game.id,
        uploaded.publicUrl,
        clientRef,
      );
    } catch (allocError) {
      // No piece available (or game finished): don't leave an orphan file.
      await removeObject(supabase, uploaded.path);
      uploadedPath = null;

      const message =
        allocError instanceof Error ? allocError.message : String(allocError);

      if (message.includes("NO_EMPTY_PIECE")) {
        return fail("Đại bàng đã đủ mảnh ghép.", "GAME_FULL", 409);
      }
      if (message.includes("GAME_ALREADY_COMPLETED")) {
        return fail("Đại bàng đã hoàn thành.", "GAME_COMPLETED", 409);
      }
      throw allocError;
    }

    // If the RPC resolved this submission to an already-stored image (race),
    // drop the file we just uploaded so no orphan is left behind.
    if (result.imageUrl && result.imageUrl !== uploaded.publicUrl) {
      await removeObject(supabase, uploaded.path);
      uploadedPath = null;
    }

    return Response.json({
      pieceIndex: result.pieceIndex,
      completedPieces: result.completedPieces,
      totalPieces: result.totalPieces,
      status: result.status,
      imageUrl: result.imageUrl || uploaded.publicUrl,
    });
  } catch (error) {
    if (uploadedPath) {
      try {
        await removeObject(getServiceSupabase(), uploadedPath);
      } catch {
        // ignore cleanup errors
      }
    }
    console.error("POST /api/upload failed", error);
    return Response.json(
      { error: "Không thể gửi ảnh. Vui lòng thử lại.", code: "UPLOAD_FAILED" },
      { status: 500 },
    );
  }
}
