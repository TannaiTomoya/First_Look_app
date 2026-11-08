"use client";

import dynamic from "next/dynamic";

// three.js / MediaPipe を Worker のサーバーバンドルに含めない
const FaceMeshLab = dynamic(() => import("./face-mesh-lab"), {
  ssr: false,
  loading: () => <p className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted">読み込み中...</p>,
});

export default function LabClient() {
  return <FaceMeshLab />;
}
