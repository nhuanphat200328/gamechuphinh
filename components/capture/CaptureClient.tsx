"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { processImageBlob, processVideoFrame, type ProcessedImage } from "@/services/image";
import {
  createClientRef,
  submitPhoto,
  UploadError,
  type SubmitPhotoResponse,
} from "@/services/upload-client";

type Mode =
  | "starting"
  | "camera"
  | "preview"
  | "uploading"
  | "success"
  | "fallback"
  | "error";

interface CaptureClientProps {
  initialGameId?: string;
}

type Facing = "environment" | "user";

function SwitchCameraIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <path d="M9.5 13.5a3 3 0 0 1 5.2-2" />
      <path d="M15.5 12.5a3 3 0 0 1-5.2 2" />
      <path d="M14.7 9.5v2h-2" />
      <path d="M10.3 16.5v-2h2" />
    </svg>
  );
}

function describeCameraError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "Không thể truy cập camera. Hãy kiểm tra quyền camera của trình duyệt.";
      case "NotFoundError":
      case "OverconstrainedError":
        return "Không tìm thấy camera phù hợp trên thiết bị.";
      case "NotReadableError":
        return "Camera đang được ứng dụng khác sử dụng.";
      default:
        return "Không thể truy cập camera. Vui lòng thử lại.";
    }
  }
  return "Không thể truy cập camera. Vui lòng thử lại.";
}

export function CaptureClient({ initialGameId }: CaptureClientProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<Mode>("starting");
  const [gameId, setGameId] = useState<string | null>(initialGameId ?? null);
  const [processed, setProcessed] = useState<ProcessedImage | null>(null);
  const [clientRef, setClientRef] = useState<string>("");
  const [result, setResult] = useState<SubmitPhotoResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [facing, setFacing] = useState<Facing>("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [switching, setSwitching] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const detectMultipleCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput");
      setHasMultipleCameras(cameras.length > 1);
    } catch {
      setHasMultipleCameras(false);
    }
  }, []);

  /** Fallback camera picker for browsers that ignore `facingMode`. */
  const getDeviceIdForFacing = useCallback(
    async (preferred: Facing): Promise<string | null> => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((d) => d.kind === "videoinput");
        if (cameras.length === 0) return null;

        const pattern =
          preferred === "environment"
            ? /(back|rear|environment|main|wide)/i
            : /(front|face|user|selfie)/i;

        const matched = cameras.find((c) => c.label && pattern.test(c.label));
        if (matched?.deviceId) return matched.deviceId;

        // No usable labels: guess by typical ordering.
        const guess =
          preferred === "environment"
            ? cameras[cameras.length - 1]
            : cameras[0];
        return guess?.deviceId || null;
      } catch {
        return null;
      }
    },
    [],
  );

  const startCamera = useCallback(
    async (preferred: Facing): Promise<boolean> => {
      setErrorMessage(null);

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setMode("fallback");
        return false;
      }

      // Always release the previous stream first so the camera is never held
      // open by two streams at once.
      stopCamera();
      setMode("starting");

      const base: MediaTrackConstraints = {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      };
      const getStream = (video: MediaTrackConstraints) =>
        navigator.mediaDevices.getUserMedia({ video, audio: false });

      let stream: MediaStream | null = null;
      let lastError: unknown = null;

      // 1) Preferred: facingMode hint (rear by default).
      try {
        stream = await getStream({ ...base, facingMode: { ideal: preferred } });
      } catch (error) {
        lastError = error;
      }

      // 2) Fallback: pick an explicit camera by deviceId.
      if (!stream) {
        const deviceId = await getDeviceIdForFacing(preferred);
        if (deviceId) {
          try {
            stream = await getStream({ ...base, deviceId: { exact: deviceId } });
          } catch (error) {
            lastError = error;
          }
        }
      }

      // 3) Last resort: any available camera.
      if (!stream) {
        try {
          stream = await getStream(base);
        } catch (error) {
          lastError = error;
        }
      }

      if (!stream) {
        setErrorMessage(describeCameraError(lastError));
        setMode("error");
        return false;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      setMode("camera");
      void detectMultipleCameras();
      return true;
    },
    [detectMultipleCameras, getDeviceIdForFacing, stopCamera],
  );

  const handleSwitchCamera = useCallback(async () => {
    if (switching) return;
    const next: Facing = facing === "environment" ? "user" : "environment";
    setSwitching(true);
    setFacing(next);
    const ok = await startCamera(next);
    if (!ok) setFacing(facing);
    setSwitching(false);
  }, [facing, startCamera, switching]);

  // Resolve the active game id (from the QR query string or the server).
  useEffect(() => {
    if (gameId) return;
    let active = true;
    fetch("/api/game", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.game?.id) setGameId(data.game.id as string);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [gameId]);

  useEffect(() => {
    void startCamera("environment");
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const image = await processVideoFrame(videoRef.current);
      setProcessed(image);
      setClientRef(createClientRef());
      stopCamera();
      setMode("preview");
    } catch {
      setErrorMessage("Không thể xử lý ảnh. Vui lòng thử lại.");
    }
  }, [stopCamera]);

  const handleFallbackFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        const image = await processImageBlob(file);
        setProcessed(image);
        setClientRef(createClientRef());
        setErrorMessage(null);
        setMode("preview");
      } catch {
        setErrorMessage("Không thể xử lý ảnh. Vui lòng chọn ảnh khác.");
      }
    },
    [],
  );

  const handleRetake = useCallback(() => {
    setProcessed(null);
    setResult(null);
    setErrorMessage(null);
    void startCamera(facing);
  }, [facing, startCamera]);

  const handleSubmit = useCallback(async () => {
    if (!processed || !gameId || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    setMode("uploading");

    try {
      const response = await submitPhoto({
        blob: processed.blob,
        gameId,
        clientRef,
        fileName: "photo",
      });
      setResult(response);
      setMode("success");
    } catch (error) {
      if (error instanceof UploadError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Không thể gửi ảnh. Vui lòng thử lại.");
      }
      setMode("preview");
    } finally {
      setSubmitting(false);
    }
  }, [clientRef, gameId, processed, submitting]);

  const canTakeAnother =
    result !== null && result.completedPieces < result.totalPieces;

  return (
    <main className="capture-root text-[var(--ink)]">
      <header className="capture-header">
        <div>
          <p className="text-[0.6rem] tracking-[0.3em] text-[var(--gold)] uppercase">
            Eagle Wings
          </p>
          <h1 className="text-lg font-bold">Gửi ảnh của bạn</h1>
        </div>
        {gameId ? (
          <span className="badge rounded-full px-3 py-1 text-[0.6rem] tracking-widest text-[var(--muted)] uppercase">
            #{gameId.slice(0, 6)}
          </span>
        ) : null}
      </header>

      <div className="capture-stage">
        <div className="capture-frame">
          {/* Live camera */}
          <video
            ref={videoRef}
            className={
              facing === "user" && mode !== "preview" && mode !== "uploading"
                ? "capture-video is-mirrored"
                : "capture-video"
            }
            style={{ display: mode === "camera" || mode === "starting" ? "block" : "none" }}
            playsInline
            muted
            autoPlay
          />

          {/* Switch front / back camera */}
          {(mode === "camera" || mode === "starting") && hasMultipleCameras ? (
            <button
              type="button"
              onClick={() => void handleSwitchCamera()}
              disabled={switching || mode === "starting"}
              aria-label="Đổi camera trước/sau"
              title="Đổi camera trước/sau"
              className="absolute top-4 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-transform active:scale-90 disabled:opacity-50"
            >
              <SwitchCameraIcon />
            </button>
          ) : null}

          {/* Preview */}
          {mode === "preview" || mode === "uploading" ? (
            processed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={processed.dataUrl}
                alt="Ảnh xem trước"
                className="h-full w-full object-contain"
              />
            ) : null
          ) : null}

          {/* Success */}
          {mode === "success" && result ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--gold)] text-3xl text-black">
                ✓
              </div>
              <h2 className="text-2xl font-black text-[var(--gold-2)]">
                Ảnh đã được gửi thành công
              </h2>
              <p className="text-sm text-[var(--muted)]">
                Ảnh của bạn đã được ghép vào mảnh #{result.pieceIndex}
              </p>
              <p className="text-sm text-[var(--muted)]">
                Tiến độ: {result.completedPieces}/{result.totalPieces}
              </p>
              {result.completedPieces >= result.totalPieces ? (
                <p className="text-base font-bold text-[var(--gold-2)]">
                  Đại bàng đã hoàn thành!
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Starting / uploading overlay */}
          {mode === "starting" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-center">
              <div className="spinner" />
              <p className="text-sm text-[var(--muted)]">Đang mở camera...</p>
            </div>
          ) : null}

          {mode === "uploading" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-center">
              <div className="spinner" />
              <p className="text-sm text-[var(--muted)]">Đang gửi ảnh...</p>
            </div>
          ) : null}

          {/* Fallback file picker */}
          {mode === "fallback" ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
              <p className="text-base text-[var(--ink)]">
                Thiết bị/trình duyệt không hỗ trợ camera trực tiếp.
              </p>
              <p className="text-sm text-[var(--muted)]">
                Hãy chụp ảnh bằng ứng dụng camera rồi chọn ảnh bên dưới.
              </p>
              <label className="btn-primary inline-flex cursor-pointer items-center justify-center rounded-full px-6 py-4 text-base">
                Mở camera / chọn ảnh
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFallbackFile}
                />
              </label>
            </div>
          ) : null}

          {/* Camera error */}
          {mode === "error" ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
              <p className="text-base text-[var(--ink)]">
                {errorMessage ??
                  "Không thể truy cập camera. Hãy kiểm tra quyền camera của trình duyệt."}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void startCamera(facing)}
                  className="btn-primary rounded-full px-6 py-3"
                >
                  Thử lại camera
                </button>
                <label className="btn-ghost inline-flex cursor-pointer items-center rounded-full px-6 py-3">
                  Chọn ảnh từ máy
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFallbackFile}
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Controls */}
      <div className="capture-controls">
        {errorMessage && mode !== "error" ? (
          <p className="mb-3 text-center text-sm text-red-300">{errorMessage}</p>
        ) : null}

        {mode === "camera" ? (
          <div className="flex items-center justify-center">
            <button
              type="button"
              aria-label="Chụp ảnh"
              className="capture-shutter"
              onClick={() => void handleCapture()}
            />
          </div>
        ) : null}

        {mode === "preview" || mode === "uploading" ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="btn-ghost rounded-2xl py-4 text-base font-semibold"
              onClick={handleRetake}
              disabled={mode === "uploading"}
            >
              Chụp lại
            </button>
            <button
              type="button"
              className="btn-primary rounded-2xl py-4 text-base font-bold disabled:opacity-60"
              onClick={() => void handleSubmit()}
              disabled={mode === "uploading" || submitting || !gameId}
            >
              {mode === "uploading" ? "Đang gửi..." : "Gửi ảnh"}
            </button>
          </div>
        ) : null}

        {mode === "success" ? (
          <div className="flex flex-col gap-3">
            {canTakeAnother ? (
              <button
                type="button"
                className="btn-primary rounded-2xl py-4 text-base font-bold"
                onClick={handleRetake}
              >
                Chụp ảnh khác
              </button>
            ) : null}
            <p className="text-center text-xs text-[var(--muted)]">
              Nhìn lên màn hình LED để xem ảnh của bạn xuất hiện.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
