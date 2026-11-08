"use client";

import { useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { analyzeSkin, fileToCanvas, type SkinMetrics } from "@/lib/face-tools";

type Feedback = { score: number; summary: string; tips: string[]; source: string };

export default function SkinDiagnosisPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [metrics, setMetrics] = useState<SkinMetrics | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onFile(f?: File) {
    if (!f) return;
    setError(null);
    setStatus(null);
    setFeedback(null);
    setFile(f);
    const canvas = await fileToCanvas(f);
    setMetrics(analyzeSkin(canvas));
    setPreview(canvas.toDataURL("image/jpeg", 0.88));
  }

  async function diagnose() {
    if (!metrics) {
      setError("先に顔写真を撮ってください。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/skin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...metrics }),
      });
      const data = (await res.json()) as Feedback & { error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          location.href = "/login?next=/skin";
          return;
        }
        throw new Error(data.error ?? "診断に失敗しました");
      }
      setFeedback(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "診断に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function saveRecord() {
    if (!file || !feedback) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const note = [
        `美肌診断 スコア${feedback.score}`,
        feedback.summary,
        ...feedback.tips.slice(0, 3),
      ].join(" / ");
      const body = new FormData();
      body.append("file", file);
      body.append("note", note.slice(0, 500));
      const res = await fetch("/api/records", { method: "POST", body });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          location.href = "/login?next=/skin";
          return;
        }
        throw new Error(data.error ?? "記録に失敗しました");
      }
      setStatus("診断結果を記録に保存しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "記録に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">美肌診断</h1>
      <p className="mt-1 text-sm text-muted">
        顔写真を撮って AI が肌の状態を診断。結果はそのまま記録に残せます（医療診断ではありません）。
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
        <div className="flex aspect-[3/4] w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-white">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="face" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm text-muted">正面の顔写真を撮る</span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => inputRef.current?.click()}>
            写真を撮る / 選ぶ
          </Button>
          <Button type="button" variant="outline" onClick={diagnose} disabled={!metrics || loading}>
            {loading ? "診断中..." : "AIで肌診断"}
          </Button>
        </div>
        {metrics && (
          <p className="mt-3 text-xs text-muted">
            明るさ {metrics.brightness} / コントラスト {metrics.contrast} / 赤み {metrics.redness} / テカリ率{" "}
            {(metrics.shineRatio * 100).toFixed(1)}%
          </p>
        )}
        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      </Card>

      {feedback && (
        <Card className="mt-4">
          <div className="flex items-center gap-3">
            <span className="font-display text-4xl font-bold text-brand">{feedback.score}</span>
            <div>
              <p className="font-semibold">美肌スコア</p>
              <p className="text-xs text-muted">
                {feedback.source === "gemini" ? "Gemini AI 診断" : "画像指標ベースの簡易診断"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm">{feedback.summary}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {feedback.tips.map((t, i) => (
              <li key={i} className="rounded-xl bg-brand/5 px-4 py-3">
                {t}
              </li>
            ))}
          </ul>
          <Button type="button" className="mt-4" onClick={saveRecord} disabled={saving}>
            {saving ? "保存中..." : "記録する"}
          </Button>
          {status && <p className="mt-3 text-sm text-brand">{status}</p>}
        </Card>
      )}
    </AppShell>
  );
}
