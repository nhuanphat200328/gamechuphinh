"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrPanelProps {
  url: string;
  completed: number;
  total: number;
}

export function QrPanel({ url, completed, total }: QrPanelProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!url) return;

    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 720,
      color: { dark: "#0b0f1a", light: "#ffffff" },
    })
      .then((value) => {
        if (active) {
          setDataUrl(value);
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-[0.7rem] tracking-[0.35em] text-[var(--gold)] uppercase">
          Quét mã để tham gia
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Mở camera điện thoại và quét mã
        </p>
      </div>

      <div className="qr-card rounded-2xl p-3">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt="QR code dẫn tới trang chụp ảnh"
            className="h-[clamp(120px,13vw,240px)] w-[clamp(120px,13vw,240px)]"
          />
        ) : (
          <div className="flex h-[clamp(120px,13vw,240px)] w-[clamp(120px,13vw,240px)] items-center justify-center text-xs text-slate-500">
            {failed ? "Không tạo được QR" : "Đang tạo QR..."}
          </div>
        )}
      </div>

      <div className="badge flex items-center gap-3 rounded-full px-4 py-2">
        <span className="text-[0.65rem] tracking-[0.25em] text-[var(--muted)] uppercase">
          Đã ghép
        </span>
        <span className="text-lg font-bold text-[var(--gold-2)] text-glow-gold">
          {completed}
          <span className="text-[var(--muted)]"> / {total}</span>
        </span>
      </div>
    </div>
  );
}
