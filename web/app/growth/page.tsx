"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { detectHighlights } from "@/lib/growth/highlights";
import { PLATFORMS, formatPct, type MetricRow, type MetricsSummary } from "@/lib/growth/metrics";
import { isVideoFile } from "@/lib/short-editor";

const emptySummary: MetricsSummary = {
  views: 0,
  likes: 0,
  saves: 0,
  comments: 0,
  follows_delta: 0,
  saveRate: 0,
  engagementRate: 0,
  count: 0,
};

type RecordingItem = {
  id: string;
  title: string | null;
  source: string | null;
  duration_sec: number | null;
  status: string;
  created_at: string;
  public_url?: string | null;
};

const SOURCES = [
  { v: "youtube_live", l: "YouTube Live" },
  { v: "ig_live", l: "Instagram Live" },
  { v: "obs", l: "OBS" },
  { v: "phone", l: "スマホ録画" },
  { v: "other", l: "その他" },
];

export default function GrowthPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MetricRow[]>([]);
  const [summary, setSummary] = useState<MetricsSummary>(emptySummary);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [ytBusy, setYtBusy] = useState(false);
  const [limitsLabel, setLimitsLabel] = useState<string | null>(null);
  const [recTitle, setRecTitle] = useState("");
  const [recSource, setRecSource] = useState("obs");
  const [form, setForm] = useState({
    platform: "instagram",
    title: "",
    posted_at: new Date().toISOString().slice(0, 10),
    views: "",
    likes: "",
    saves: "",
    comments: "",
    follows_delta: "",
    note: "",
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mRes, rRes] = await Promise.all([
        fetch("/api/growth/metrics?summary=1"),
        fetch("/api/growth/recordings"),
      ]);
      if (mRes.status === 401 || rRes.status === 401) {
        location.href = "/login?next=/growth";
        return;
      }
      const mData = (await mRes.json()) as {
        items?: MetricRow[];
        summary?: MetricsSummary;
        needsMigration?: boolean;
        error?: string;
      };
      if (!mRes.ok) throw new Error(mData.error ?? "読み込み失敗");
      setItems(mData.items ?? []);
      setSummary(mData.summary ?? emptySummary);
      setNeedsMigration(Boolean(mData.needsMigration));

      const rData = (await rRes.json()) as {
        items?: RecordingItem[];
        needsMigration?: boolean;
        error?: string;
      };
      if (rRes.ok) {
        setRecordings(rData.items ?? []);
        if (rData.needsMigration) setNeedsMigration(true);
      }
      try {
        const lRes = await fetch("/api/growth/limits");
        if (lRes.ok) {
          const l = (await lRes.json()) as {
            limits?: {
              isPremium: boolean;
              isAnnual?: boolean;
              youtubeImport?: boolean;
              coachUsed: number;
              coachLimit: number;
              clipUsed: number;
              clipLimit: number;
              maxRecordingSec: number;
            };
          };
          const x = l.limits;
          if (x) {
            const coach = x.coachLimit < 0 ? "無制限" : `${x.coachUsed}/${x.coachLimit}`;
            const tier = x.isAnnual ? "年額" : x.isPremium ? "月額" : "Free";
            setLimitsLabel(
              `${tier} · 壁打ち ${coach} · クリップ ${x.clipUsed}/${x.clipLimit} · 録画上限${x.maxRecordingSec}s` +
                (x.youtubeImport ? " · YT取込OK" : " · YT取込は年額"),
            );
          }
        }
      } catch {
        // ignore
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込み失敗");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function uploadRecording(file: File) {
    if (!isVideoFile(file)) {
      setError("動画（mp4/mov等）を選んでください");
      return;
    }
    setUploading(true);
    setError(null);
    setStatus("ハイライト解析中…");
    try {
      const detected = await detectHighlights(file, { clipLen: 15, maxCandidates: 5 });
      const highlights = detected.highlights;
      const duration = detected.duration;

      setStatus("アップロード中…");
      const body = new FormData();
      body.append("file", file);
      body.append("title", recTitle || file.name.replace(/\.[^.]+$/, ""));
      body.append("source", recSource);
      body.append("duration_sec", String(duration));
      body.append("highlights", JSON.stringify(highlights.map((h, i) => ({ ...h, selected: i < 3 }))));

      const res = await fetch("/api/growth/recordings", { method: "POST", body });
      const data = (await res.json()) as {
        error?: string;
        recording?: { id: string };
      };
      if (!res.ok) throw new Error(data.error ?? "アップロード失敗");
      setStatus("完了。ハイライト画面へ移ります…");
      setRecTitle("");
      if (data.recording?.id) {
        location.href = `/growth/${data.recording.id}`;
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロード失敗");
      setStatus(null);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/growth/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: form.platform,
          title: form.title,
          posted_at: form.posted_at,
          views: Number(form.views) || 0,
          likes: Number(form.likes) || 0,
          saves: Number(form.saves) || 0,
          comments: Number(form.comments) || 0,
          follows_delta: Number(form.follows_delta) || 0,
          note: form.note,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          location.href = "/login?next=/growth";
          return;
        }
        throw new Error(data.error ?? "保存に失敗しました");
      }
      setStatus("数値を記録しました。");
      setForm((f) => ({
        ...f,
        title: "",
        views: "",
        likes: "",
        saves: "",
        comments: "",
        follows_delta: "",
        note: "",
      }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id?: string) {
    if (!id) return;
    await fetch(`/api/growth/metrics?id=${id}`, { method: "DELETE" });
    await load();
  }

  const input =
    "w-full rounded-2xl border border-line px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand";

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">成長スタジオ</h1>
      <p className="mt-1 text-sm text-muted">
        配信録画を取り込み → ハイライト切り抜き → 数値記録 → 音声で作戦会議。
      </p>

      {needsMigration && (
        <Card className="mt-4 border-accent/40 bg-accent/5">
          <p className="text-sm">
            DB未設定の可能性があります。Supabase SQL Editor で{" "}
            <code className="rounded bg-white px-1">0004_growth.sql</code> と{" "}
            <code className="rounded bg-white px-1">0005</code> / <code className="rounded bg-white px-1">0006_growth_phase2.sql</code> を実行してください。
          </p>
        </Card>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: "再生", v: summary.views.toLocaleString() },
          { k: "保存率", v: formatPct(summary.saveRate) },
          { k: "反応率", v: formatPct(summary.engagementRate) },
          { k: "フォロワー増減", v: `${summary.follows_delta >= 0 ? "+" : ""}${summary.follows_delta}` },
        ].map((x) => (
          <Card key={x.k} className="!p-4">
            <p className="text-xs text-muted">{x.k}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-brand">{x.v}</p>
          </Card>
        ))}
      </div>

      {limitsLabel && <p className="mt-3 text-xs text-muted">{limitsLabel}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button href="/growth/coach">音声で作戦会議</Button>
        <Button href="/growth/plans" variant="outline">
          発信プラン
        </Button>
        <Button href="/shorts" variant="outline">
          ショート一覧
        </Button>
        <Button href="/pricing" variant="outline">
          Premium
        </Button>
      </div>

      <Card className="mt-6">
        <h2 className="font-semibold">① 配信録画を取り込む（Phase 1）</h2>
        <p className="mt-1 text-xs text-muted">
          YouTube / IG / OBS などの録画（mp4・mov、最大200MB）。アップロード前にブラウザでハイライト解析します。
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="video/*,video/quicktime,.mov,.mp4,.m4v,.webm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadRecording(f);
            e.target.value = "";
          }}
        />
        <input
          className={`${input} mt-3`}
          placeholder="タイトル（任意）"
          value={recTitle}
          onChange={(e) => setRecTitle(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <Button
              key={s.v}
              type="button"
              variant={recSource === s.v ? "primary" : "outline"}
              onClick={() => setRecSource(s.v)}
            >
              {s.l}
            </Button>
          ))}
        </div>
        <div className="mt-3">
          <Button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "処理中..." : "録画を選んで取り込む"}
          </Button>
        </div>
        {status && <p className="mt-3 text-sm text-brand">{status}</p>}
        {error && <p className="mt-3 text-sm text-accent">{error}</p>}

        {recordings.length > 0 && (
          <ul className="mt-4 space-y-2">
            {recordings.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/growth/${r.id}`}
                  className="flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm hover:border-brand"
                >
                  <span>
                    <span className="font-medium">{r.title || "無題"}</span>
                    <span className="ml-2 text-xs text-muted">
                      {r.source} · {r.duration_sec ? `${Math.round(Number(r.duration_sec))}s` : ""} · {r.status}
                    </span>
                  </span>
                  <span className="text-brand">開く →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="font-semibold">② YouTubeから数値を取り込む（Phase 2）</h2>
        <p className="mt-1 text-xs text-muted">
          公開動画のURLまたはID。YOUTUBE_API_KEY があれば再生数などを自動取得します。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className={input}
            placeholder="https://youtube.com/watch?v=... または動画ID"
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
          />
          <Button
            type="button"
            disabled={ytBusy || !ytUrl.trim()}
            onClick={async () => {
              setYtBusy(true);
              setError(null);
              setStatus(null);
              try {
                const res = await fetch("/api/growth/youtube", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ url: ytUrl.trim() }),
                });
                const data = (await res.json()) as { error?: string; hint?: string | null };
                if (!res.ok) throw new Error(data.error ?? "取込失敗");
                setStatus(data.hint ? `取込完了（${data.hint}）` : "YouTubeの数値を取り込みました。");
                setYtUrl("");
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "取込失敗");
              } finally {
                setYtBusy(false);
              }
            }}
          >
            {ytBusy ? "取込中..." : "取り込む"}
          </Button>
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="font-semibold">③ 投稿の数値を手入力</h2>
        <p className="mt-1 text-xs text-muted">切り抜き公開後の views / saves などを手入力。</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <Button
                key={p}
                type="button"
                variant={form.platform === p ? "primary" : "outline"}
                onClick={() => setForm((f) => ({ ...f, platform: p }))}
              >
                {p}
              </Button>
            ))}
          </div>
          <input
            className={input}
            placeholder="投稿タイトル（任意）"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <label className="text-xs text-muted">
              投稿日
              <input
                type="date"
                className={`${input} mt-1`}
                value={form.posted_at}
                onChange={(e) => setForm((f) => ({ ...f, posted_at: e.target.value }))}
              />
            </label>
            {(
              [
                ["views", "再生"],
                ["likes", "いいね"],
                ["saves", "保存"],
                ["comments", "コメント"],
                ["follows_delta", "フォロワー増減"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-xs text-muted">
                {label}
                <input
                  type="number"
                  className={`${input} mt-1`}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <input
            className={input}
            placeholder="メモ（任意）"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
          <Button type="submit" disabled={saving}>
            {saving ? "保存中..." : "数値を保存"}
          </Button>
        </form>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold">直近の数値ログ</h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">まだありません。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {r.platform} · {r.title || r.note || "投稿"}
                  </p>
                  <p className="text-xs text-muted">
                    views {r.views} / likes {r.likes} / saves {r.saves} / Δfol {r.follows_delta}
                  </p>
                </div>
                <button type="button" className="text-xs text-accent" onClick={() => remove(r.id)}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
