"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { analyzeSkin, fileToCanvas, type SkinMetrics } from "@/lib/face-tools";

const STEPS = [
  { t: "洗顔チェック", d: "直近2時間以内に洗顔した？ ぬるま湯・こすらない が基本。", sec: 40 },
  { t: "正面を撮影", d: "明るい場所で正面から1枚。カメラと目線を水平に。", sec: 60 },
  { t: "Tゾーン確認", d: "額と鼻のテカリを指の腹で確認。ベタつきの程度を選択。", sec: 50 },
  { t: "頬の乾燥確認", d: "頬を軽く触って、つっぱり・粉ふきがないか確認。", sec: 50 },
  { t: "眉・ヒゲの輪郭", d: "眉下のムダ毛・ヒゲの剃り残しを鏡で確認。", sec: 60 },
  { t: "AIフィードバック", d: "撮影画像の解析とセルフ回答から改善アクションを提示。", sec: 40 },
];

type Feedback = { score: number; summary: string; tips: string[]; source: string };

export default function SkinCheckPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [left, setLeft] = useState(STEPS[0].sec);
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState<SkinMetrics | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [running]);

  function goto(i: number) {
    setStep(i);
    setLeft(STEPS[i].sec);
  }

  async function onFile(f?: File) {
    if (!f) return;
    setError(null);
    const canvas = await fileToCanvas(f);
    setMetrics(analyzeSkin(canvas));
    setPreview(canvas.toDataURL("image/jpeg", 0.85));
  }

  function pick(key: string, val: string) {
    setAnswers((a) => ({ ...a, [key]: val }));
  }

  async function submit() {
    if (!metrics) {
      setError("先にステップ2で写真を撮ってください。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/skin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...metrics, answers }),
      });
      const data = (await res.json()) as Feedback & { error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          location.href = "/login?next=/skin-check";
          return;
        }
        throw new Error(data.error ?? "解析に失敗しました");
      }
      setFeedback(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  const s = STEPS[step];
  const total = STEPS.reduce((a, b) => a + b.sec, 0);

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">5分間 肌チェック</h1>
      <p className="mt-1 text-sm text-muted">
        全{STEPS.length}ステップ・合計約{Math.round(total / 60)}分。画像解析は端末内で行い、数値だけをAIに送ります。
      </p>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-brand">
            STEP {step + 1}/{STEPS.length}
          </span>
          <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand">
            残り {left}秒
          </span>
        </div>
        <h2 className="mt-3 text-xl font-semibold">{s.t}</h2>
        <p className="mt-1 text-sm text-muted">{s.d}</p>

        {step === 1 && (
          <div className="mt-4">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button type="button" onClick={() => inputRef.current?.click()}>
              写真を撮る / 選ぶ
            </Button>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="skin" className="mt-3 w-40 rounded-2xl border border-line" />
            )}
            {metrics && (
              <p className="mt-2 text-xs text-muted">
                明るさ {metrics.brightness} / コントラスト {metrics.contrast} / 赤み {metrics.redness} / テカリ率{" "}
                {(metrics.shineRatio * 100).toFixed(1)}%
              </p>
            )}
          </div>
        )}
        {step === 2 && (
          <div className="mt-4 flex gap-2">
            {["サラサラ", "少しベタつく", "かなりベタつく"].map((v) => (
              <Button
                key={v}
                type="button"
                variant={answers.tzone === v ? "primary" : "outline"}
                onClick={() => pick("tzone", v)}
              >
                {v}
              </Button>
            ))}
          </div>
        )}
        {step === 3 && (
          <div className="mt-4 flex gap-2">
            {["しっとり", "つっぱる", "粉ふき"].map((v) => (
              <Button
                key={v}
                type="button"
                variant={answers.cheek === v ? "primary" : "outline"}
                onClick={() => pick("cheek", v)}
              >
                {v}
              </Button>
            ))}
          </div>
        )}
        {step === 4 && (
          <div className="mt-4 flex gap-2">
            {["整っている", "少し伸びた", "手入れしていない"].map((v) => (
              <Button
                key={v}
                type="button"
                variant={answers.brow === v ? "primary" : "outline"}
                onClick={() => pick("brow", v)}
              >
                {v}
              </Button>
            ))}
          </div>
        )}
        {step === 5 && (
          <div className="mt-4">
            <Button type="button" onClick={submit} disabled={loading}>
              {loading ? "解析中..." : "AIフィードバックを見る"}
            </Button>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => goto(step - 1)}>
              戻る
            </Button>
          )}
          {step < STEPS.length - 1 && (
            <Button
              type="button"
              onClick={() => {
                setRunning(true);
                goto(step + 1);
              }}
            >
              次へ
            </Button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      </Card>

      {feedback && (
        <Card className="mt-4">
          <div className="flex items-center gap-3">
            <span className="font-display text-4xl font-bold text-brand">{feedback.score}</span>
            <div>
              <p className="font-semibold">今日の肌スコア</p>
              <p className="text-xs text-muted">
                {feedback.source === "gemini" ? "Gemini AI 解析" : "画像指標ベースの簡易解析"}
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {feedback.tips.map((t, i) => (
              <li key={i} className="rounded-xl bg-brand/5 px-4 py-3">
                {t}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  );
}
