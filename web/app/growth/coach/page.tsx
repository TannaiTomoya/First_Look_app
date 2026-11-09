"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { formatPct, type MetricsSummary } from "@/lib/growth/metrics";

type Turn = { role: "user" | "assistant"; content: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export default function GrowthCoachPage() {
  const [history, setHistory] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [endedSummary, setEndedSummary] = useState<string | null>(null);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  useEffect(() => {
    return () => {
      try {
        recogRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  function speakText(text: string) {
    if (!speak || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }

  async function send(message: string, end = false) {
    const msg = message.trim();
    if (!msg && !end) return;
    setLoading(true);
    setError(null);
    if (msg) setHistory((h) => [...h, { role: "user", content: msg }]);
    setInput("");
    try {
      const res = await fetch("/api/growth/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history,
          end,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        ended?: boolean;
        summary?: MetricsSummary;
      };
      if (!res.ok) {
        if (res.status === 401) {
          location.href = "/login?next=/growth/coach";
          return;
        }
        throw new Error(data.error ?? "応答に失敗しました");
      }
      if (data.summary) setSummary(data.summary);
      const reply = data.reply ?? "";
      setHistory((h) => [...h, { role: "assistant", content: reply }]);
      speakText(reply);
      if (data.ended) setEndedSummary(reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "応答に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function toggleListen() {
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = getRecognition();
    if (!rec) {
      setError("このブラウザは音声認識に未対応です。Chrome推奨。テキスト入力も使えます。");
      return;
    }
    recogRef.current = rec;
    rec.lang = "ja-JP";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const text = Array.from(ev.results)
        .map((r) => r[0].transcript)
        .join("");
      if (text.trim()) void send(text.trim());
    };
    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error !== "aborted") setError(`音声認識エラー: ${ev.error}`);
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      setListening(true);
      setError(null);
    } catch {
      setError("マイクを開始できませんでした。");
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">音声で作戦会議</h1>
      <p className="mt-1 text-sm text-muted">
        投稿の数値を見ながら、AIと口頭で壁打ち。終了時に「今週やる3つ」を保存します。
      </p>

      {summary && (
        <Card className="mt-4 !py-3">
          <p className="text-xs text-muted">参照中のKPI</p>
          <p className="text-sm">
            投稿{summary.count} · 再生{summary.views} · 保存率{formatPct(summary.saveRate)} · 反応率
            {formatPct(summary.engagementRate)} · Δfol {summary.follows_delta}
          </p>
        </Card>
      )}

      <Card className="mt-4 flex max-h-[50vh] flex-col overflow-hidden !p-0">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {history.length === 0 && (
            <p className="text-sm text-muted">
              例: 「保存率が低い原因は？」「来週の婚活向け投稿、何から出す？」
            </p>
          )}
          {history.map((t, i) => (
            <div
              key={i}
              className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                t.role === "user" ? "ml-8 bg-brand/10" : "mr-8 bg-white border border-line"
              }`}
            >
              <p className="mb-1 text-[10px] font-semibold uppercase text-muted">
                {t.role === "user" ? "あなた" : "コーチ"}
              </p>
              {t.content}
            </div>
          ))}
          {loading && <p className="text-xs text-muted">考え中...</p>}
          <div ref={bottomRef} />
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant={listening ? "accent" : "primary"} onClick={toggleListen} disabled={loading}>
          {listening ? "録音停止" : "マイクで話す"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setSpeak((s) => !s)}>
          読み上げ: {speak ? "ON" : "OFF"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loading || history.length === 0}
          onClick={() => void send("", true)}
        >
          会議を終えて3つ出す
        </Button>
        <Button href="/growth" variant="ghost">
          成長スタジオへ
        </Button>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="テキストでも送れます"
          className="flex-1 rounded-2xl border border-line px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          送信
        </Button>
      </form>

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      {endedSummary && (
        <Card className="mt-4">
          <h2 className="font-semibold">今週やる3つ（保存済み）</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{endedSummary}</p>
        </Card>
      )}
    </AppShell>
  );
}
