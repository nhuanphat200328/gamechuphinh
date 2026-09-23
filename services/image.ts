import { MAX_UPLOAD_EDGE } from "@/lib/config";

export interface ProcessedImage {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  type: string;
  bytes: number;
}

function pickMimeType(): string {
  if (typeof document === "undefined") return "image/jpeg";
  const canvas = document.createElement("canvas");
  if (canvas.toDataURL("image/webp").startsWith("data:image/webp")) {
    return "image/webp";
  }
  return "image/jpeg";
}

function drawToCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxEdge: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const longest = Math.max(sourceWidth, sourceHeight);
  const scale = longest > maxEdge ? maxEdge / longest : 1;

  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);

  return { canvas, width, height };
}

function canvasToResult(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): Promise<ProcessedImage> {
  const type = pickMimeType();
  const quality = 0.85;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("ENCODE_FAILED"));
          return;
        }
        resolve({
          blob,
          dataUrl: canvas.toDataURL(type, quality),
          width,
          height,
          type,
          bytes: blob.size,
        });
      },
      type,
      quality,
    );
  });
}

/** Resize + compress a captured video frame. */
export async function processVideoFrame(
  video: HTMLVideoElement,
  maxEdge = MAX_UPLOAD_EDGE,
): Promise<ProcessedImage> {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) throw new Error("VIDEO_NOT_READY");

  const { canvas, width, height } = drawToCanvas(
    video,
    sourceWidth,
    sourceHeight,
    maxEdge,
  );
  return canvasToResult(canvas, width, height);
}

/** Resize + compress an image file / blob (camera fallback or picked file). */
export async function processImageBlob(
  blob: Blob,
  maxEdge = MAX_UPLOAD_EDGE,
): Promise<ProcessedImage> {
  const bitmap = await loadBitmap(blob);
  const { canvas, width, height } = drawToCanvas(
    bitmap.source,
    bitmap.width,
    bitmap.height,
    maxEdge,
  );
  bitmap.release();
  return canvasToResult(canvas, width, height);
}

interface LoadedBitmap {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function loadBitmap(blob: Blob): Promise<LoadedBitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // fall through to the <img> based loader
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImageElement(url);
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
    img.src = src;
  });
}
