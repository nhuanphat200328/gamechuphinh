import type { UploadResult } from "@/lib/types";

export interface SubmitPhotoParams {
  blob: Blob;
  gameId: string;
  clientRef: string;
  fileName?: string;
  signal?: AbortSignal;
}

export interface SubmitPhotoResponse extends UploadResult {
  imageUrl: string;
}

export class UploadError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "UploadError";
    this.code = code;
    this.status = status;
  }
}

export function createClientRef(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function submitPhoto({
  blob,
  gameId,
  clientRef,
  fileName = "photo",
  signal,
}: SubmitPhotoParams): Promise<SubmitPhotoResponse> {
  const form = new FormData();
  form.append("file", blob, fileName);
  form.append("gameId", gameId);
  form.append("clientRef", clientRef);

  let response: Response;
  try {
    response = await fetch("/api/upload", { method: "POST", body: form, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new UploadError(
      "Không có kết nối mạng. Vui lòng kiểm tra kết nối.",
      "NETWORK",
      0,
    );
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new UploadError(
      (payload.error as string) || "Không thể gửi ảnh. Vui lòng thử lại.",
      (payload.code as string) || "UPLOAD_FAILED",
      response.status,
    );
  }

  return payload as unknown as SubmitPhotoResponse;
}
