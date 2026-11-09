"use client";

import dynamic from "next/dynamic";
import type { FutureFaceAccess } from "@/lib/future-face/access";

// three.js / MediaPipe を Worker のサーバーバンドルに含めない
const FutureFaceClient = dynamic(() => import("./future-face-client"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted">読み込み中...</p>,
});

export default function FutureFaceLoader(props: { access: FutureFaceAccess; upgradeMessage: string | null }) {
  return <FutureFaceClient {...props} />;
}
