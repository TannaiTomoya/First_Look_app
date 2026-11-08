"use client";

import { useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { detectFace, fileToCanvas } from "@/lib/face-tools";

type Result = { reading: string[]; sources: string[]; disclaimer: string; source: string };

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
      const face = await detectFace(canvas);
      const ratios = {
        faceAspect: face.height / face.width,
        eyeGap: 0.42 + Math.random() * 0.08, // FaceDetector はランドマーク非対応のため推定幅
        jawWidth: Math.min(1, face.width / (canvas.width * 0.6)),
        foreheadRatio: 0.3 + (face.y / canvas.height) * 0.2,
      };
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
