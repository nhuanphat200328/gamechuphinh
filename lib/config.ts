import { EAGLE_PIECES } from "./eagle-geometry";

/**
 * Safe env reader. Next.js only inlines `NEXT_PUBLIC_*` values into the client
 * bundle; this guard keeps non-public keys from ever throwing in the browser.
 */
function readEnv(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[key];
}

/** Storage bucket that holds the audience photos. */
export const STORAGE_BUCKET =
  readEnv("SUPABASE_STORAGE_BUCKET") || "game-uploads";

/** Default number of puzzle pieces (also editable from the DB). */
export const DEFAULT_TOTAL_PIECES = Number(
  readEnv("GAME_TOTAL_PIECES") || EAGLE_PIECES.length,
);

/** Demo image used for fresh pieces (relative to /public). */
export const DEMO_IMAGE_URL = "/eagle.svg";

/** Largest edge (px) an uploaded photo is resized to before upload. */
export const MAX_UPLOAD_EDGE = 1800;

/** Hard limit for the incoming file (bytes). */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** Allowed mime types for uploads. */
export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/** How long to wait before re-checking the active game while disconnected. */
export const POLL_INTERVAL_MS = 12_000;

/**
 * Base URL for the mobile capture page / QR code.
 * Falls back to the browser origin when no explicit URL is configured, so
 * no localhost value is ever hard-coded into production.
 */
export function resolveSiteUrl(currentOrigin?: string): string {
  // Direct reference so the bundler can inline the NEXT_PUBLIC_ value.
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL || readEnv("NEXT_PUBLIC_SITE_URL") || "";
  const trimmed = configured.trim();
  if (trimmed) return trimmed.replace(/\/+$/, "");
  if (currentOrigin) return currentOrigin.replace(/\/+$/, "");
  return "";
}
