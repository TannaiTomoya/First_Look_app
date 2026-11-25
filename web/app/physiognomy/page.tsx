"use client";

import { AiFallbackNotice } from "@/components/ai-fallback-notice";
import { useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { fileToCanvas } from "@/lib/face-tools";
import { qualityIssues, register } from "@/lib/face-mesh/canonical";
import { detectFace } from "@/lib/face-mesh/landmarker";
import { physiognomyRatios } from "@/lib/face-mesh/physiognomy";

type Result = { reading: string[]; sources: string[]; disclaimer: string; source: string; ai?: boolean };

export default function PhysiognomyPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(f?: File) {
    if (!f) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const canvas = await fileToCanvas(f);
      setPreview(canvas.toDataURL("image/jpeg", 0.85));
      // 478点のランドマークを検出し、顔の向きを補正した座標で比率を測る（同じ画像なら同じ値）
      const det = await detectFace(canvas);
      if (!det) {
        throw new Error("顔を検出できませんでした。顔全体が写った明るい写真で、もう一度お試しください。");
      }
      const reg = register(det.face, det.matrix);
      const jawOpen = det.blendshapes.find((b) => b.name === "jawOpen")?.score ?? 0;
      const issues = qualityIssues(reg.pose, jawOpen);
      if (issues.length > 0) {
        throw new Error(`正しく測れない写真です（${issues.join("・")}）。正面を向き、口を閉じて撮り直してください。`);
      }
      const ratios = physiognomyRatios(reg.points);
      const res = await fetch("/api/ai/physiognomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ratios),
      });
      const data = (await res.json()) as Result & { error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          location.href = "/login?next=/physiognomy";
          return;
        }
        throw new Error(data.error ?? "解析に失敗しました");
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">人相リーディング AI</h1>
      <p className="mt-1 text-sm text-muted">
        観相学の古典的な解釈と第一印象研究に基づいて「どう見られやすいか」を読みます。出典は下部に明記。
      </p>

      <Card className="mt-6">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={loading}>
          {loading ? "読み取り中..." : "顔写真を撮る / 選ぶ"}
        </Button>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="face" className="mt-4 w-40 rounded-2xl border border-line" />
        )}
        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      </Card>

      {result && (
        <>
          <AiFallbackNotice show={result.ai === false} className="mt-4" />
          <Card className="mt-4">
            <h2 className="font-semibold">リーディング結果</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {result.reading.map((r, i) => (
                <li key={i} className="rounded-xl bg-brand/5 px-4 py-3">
                  {r}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="mt-4">
            <h2 className="text-sm font-semibold">出典</h2>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {result.sources.map((s, i) => (
                <li key={i}>・{s}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">{result.disclaimer}</p>
          </Card>
        </>
      )}
    </AppShell>
  );
}
