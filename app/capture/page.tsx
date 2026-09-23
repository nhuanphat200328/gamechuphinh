import type { Metadata } from "next";
import { CaptureClient } from "@/components/capture/CaptureClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gửi ảnh ghép đại bàng",
  description: "Chụp ảnh và gửi để ghép vào màn hình đại bàng.",
};

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const game = typeof params.game === "string" ? params.game : undefined;

  return <CaptureClient initialGameId={game} />;
}
