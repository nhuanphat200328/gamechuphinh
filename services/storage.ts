import type { SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_BUCKET } from "@/lib/config";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function extensionForMime(mime: string): string {
  return EXTENSION_BY_MIME[mime] ?? "jpg";
}

/**
 * Collision-free object path. The original filename is never used.
 * Shape: `<gameId>/<timestamp>-<uuid>.<ext>`
 */
export function buildObjectPath(gameId: string, mime: string): string {
  const ext = extensionForMime(mime);
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${gameId}/${Date.now()}-${id}.${ext}`;
}

export async function uploadObject(
  supabase: SupabaseClient,
  path: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<{ path: string; publicUrl: string }> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, data, { contentType, upsert: false, cacheControl: "31536000" });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  return { path, publicUrl: publicUrlData.publicUrl };
}

export async function removeObject(
  supabase: SupabaseClient,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) {
    // Best-effort cleanup: never let a failed delete break the request.
    console.error("storage cleanup failed", error.message);
  }
}
