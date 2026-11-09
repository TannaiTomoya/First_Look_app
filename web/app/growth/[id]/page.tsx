"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { exportHighlightClip } from "@/lib/growth/highlights";
import { CLIP_TEMPLATES, getTemplate } from "@/lib/growth/templates";

type Highlight = {
  id: string;
  start_sec: number;
  end_sec: number;
  score: number;
  reason: string | null;
  selected: boolean;
};

type Clip = {
  id: string;
  url: string;
  caption: string | null;
  hashtags: string[] | null;
  platform_hint: string | null;
  short_id: string | null;
};

type Recording = {
  id: string;
  title: string | null;
  url: string;
  duration_sec: number | null;
  source: string | null;
};

export default function GrowthRecordingPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const fileRef = useRef<File | null>(null);
  const localInputRef = useRef<HTMLInputElement>(null);

  const [rec, setRec] = useState<Recording | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [title, setTitle] = useState("FIRSTLOOK");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [batching, setBatching] = useState(false);
  const [templateKey, setTemplateKey] = useState("standard_15");

  const load = useCallback(async () => {
    const res = await fetch(`/api/growth/recordings/${id}`);
    if (res.status === 401) {
      location.href = `/login?next=/growth/${id}`;
      return;
    }
    const data = (await res.json()) as {
      recording?: Recording;
      highlights?: Highlight[];
      clips?: Clip[];
      error?: string;
    };
    if (!res.ok) {
      setError(data.error ?? "読み込み失敗");
      return;
    }
    setRec(data.recording ?? null);
    setHighlights(data.highlights ?? []);
    setClips(data.clips ?? []);
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function toggle(h: Highlight) {
    const next = !h.selected;
    setHighlights((list) => list.map((x) => (x.id === h.id ? { ...x, selected: next } : x)));
    await fetch(`/api/growth/highlights/${h.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected: next }),
    });
  }

  async function ensureLocalFile(): Promise<File> {
    if (fileRef.current) return fileRef.current;
    if (!rec?.url) throw new Error("録画URLがありません");
    setStatus("録画を取得中…");
    const res = await fetch(rec.url);
    if (!res.ok) throw new Error("録画のダウンロードに失敗しました。同じファイルを再選択してください。");
    const blob = await res.blob();
    const file = new File([blob], "recording.mp4", { type: blob.type || "video/mp4" });
    fileRef.current = file;
    return file;
  }

  async function generateOne(h: Highlight) {
    setBusyId(h.id);
    setError(null);
    setStatus(null);
    try {
      const file = await ensureLocalFile();
      setStatus(`クリップ生成中 ${h.start_sec}s〜${h.end_sec}s…`);
      const tpl = getTemplate(templateKey);
      const { blob } = await exportHighlightClip(file, h.start_sec, h.end_sec, title, tpl);
      const body = new FormData();
      body.append("file", new File([blob], `clip-${h.id}.webm`, { type: blob.type || "video/webm" }));
      body.append("recording_id", id);
      body.append("highlight_id", h.id);
      body.append("title", title);
      body.append("reason", h.reason ?? "");
      body.append("publish_short", "1");
      body.append("template_key", templateKey);
      const res = await fetch("/api/growth/clips", { method: "POST", body });
      const data = (await res.json()) as { error?: string; caption?: string };
      if (!res.ok) throw new Error(data.error ?? "保存に失敗しました");
      setStatus(`完了: ${data.caption?.slice(0, 40) ?? "クリップ保存"}（ショートにも公開）`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  async function generateSelected() {
    const selected = highlights.filter((h) => h.selected);
    if (!selected.length) {
      setError("採用するハイライトにチェックを入れてください");
      return;
    }
    setBatching(true);
    setError(null);
    try {
      // Phase2: ジョブキューに投入してからクライアントWorkerとして消化
      const jr = await fetch("/api/growth/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recording_id: id,
          highlight_ids: selected.map((h) => h.id),
          template_key: templateKey,
          title,
        }),
      });
      const jd = (await jr.json()) as { error?: string; job?: { id: string; payload?: { highlight_ids?: string[] } } };
      if (!jr.ok) throw new Error(jd.error ?? "ジョブ作成に失敗");
      const jobId = jd.job?.id;
      if (jobId) {
        await fetch(`/api/growth/jobs/${jobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "running" }),
        });
      }
      const ids = jd.job?.payload?.highlight_ids ?? selected.map((h) => h.id);
      const done: string[] = [];
      for (const hid of ids) {
        const h = highlights.find((x) => x.id === hid);
        if (!h) continue;
        await generateOne(h);
        done.push(hid);
      }
      if (jobId) {
        await fetch(`/api/growth/jobs/${jobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "done", result: { clip_highlight_ids: done, template_key: templateKey } }),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "一括生成に失敗");
    } finally {
      setBatching(false);
    }
  }

  return (
    <AppShell>
      <p className="text-sm text-muted">
        <Link href="/growth" className="text-brand underline">
          成長スタジオ
        </Link>{" "}
        / 録画
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold">{rec?.title ?? "録画詳細"}</h1>
      <p className="mt-1 text-sm text-muted">
        ハイライトを選び、9:16クリップを生成 → キャプションAI → ショート公開まで一気に。
      </p>

      {rec && (
        <Card className="mt-6">
          <video src={rec.url} controls playsInline className="aspect-video w-full rounded-2xl bg-black" />
          <p className="mt-2 text-xs text-muted">
            {rec.source ?? "source"} · {rec.duration_sec ? `${Math.round(Number(rec.duration_sec))}秒` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="テロップ文言"
              className="min-w-[12rem] flex-1 rounded-2xl border border-line px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
            <input
              ref={localInputRef}
              type="file"
              accept="video/*,.mov,.mp4"
              className="hidden"
              onChange={(e) => {
                fileRef.current = e.target.files?.[0] ?? null;
                if (fileRef.current) setStatus(`ローカルファイルを使用: ${fileRef.current.name}`);
              }}
            />
            <Button type="button" variant="outline" onClick={() => localInputRef.current?.click()}>
              同じ動画を再選択
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            CORSやコーデックでダウンロードできない場合は、アップロード時と同じファイルを再選択してください。
          </p>
        </Card>
      )}

      <Card className="mt-4">
        <h2 className="font-semibold">切り抜きテンプレ（A/B）</h2>
        <p className="mt-1 text-xs text-muted">
          月額は標準15秒のみ。A/B/C全開放は年額Premiumの特典です。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CLIP_TEMPLATES.map((t) => (
            <Button
              key={t.key}
              type="button"
              variant={templateKey === t.key ? "primary" : "outline"}
              onClick={() => setTemplateKey(t.key)}
            >
              {t.label}
              {t.key !== "standard_15" ? " ·年額" : ""}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{getTemplate(templateKey).description}</p>
      </Card>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">ハイライト候補</h2>
          <Button type="button" onClick={generateSelected} disabled={batching || !!busyId}>
            {batching ? "ジョブ実行中..." : "採用分をジョブ生成"}
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {highlights.map((h) => (
            <li
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-4 py-3 text-sm"
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={h.selected} onChange={() => void toggle(h)} className="mt-1" />
                <span>
                  <span className="font-medium">
                    {h.start_sec}s → {h.end_sec}s
                  </span>
                  <span className="ml-2 text-xs text-brand">score {h.score}</span>
                  <p className="text-xs text-muted">{h.reason}</p>
                </span>
              </label>
              <Button
                type="button"
                variant="outline"
                className="!px-3 !py-1 text-xs"
                disabled={!!busyId || batching}
                onClick={() => void generateOne(h)}
              >
                {busyId === h.id ? "生成中..." : "この区間だけ"}
              </Button>
            </li>
          ))}
          {highlights.length === 0 && (
            <p className="text-sm text-muted">ハイライトがありません。ハブから再アップロードしてください。</p>
          )}
        </ul>
        {status && <p className="mt-3 text-sm text-brand">{status}</p>}
        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold">生成済みクリップ</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          {clips.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-line bg-black">
              <video src={c.url} controls playsInline className="aspect-[9/16] w-full object-cover" />
              <div className="bg-card px-3 py-2 text-xs">
                <p className="line-clamp-3">{c.caption}</p>
                {c.hashtags?.length ? (
                  <p className="mt-1 text-muted">{c.hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" ")}</p>
                ) : null}
                {c.short_id && <p className="mt-1 text-brand">ショート公開済</p>}
              </div>
            </div>
          ))}
          {clips.length === 0 && <p className="col-span-full text-sm text-muted">まだありません。</p>}
        </div>
      </Card>
    </AppShell>
  );
}
