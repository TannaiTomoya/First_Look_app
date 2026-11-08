"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { autoEditShortVideo, isVideoFile } from "@/lib/short-editor";

type Short = {
  id: string;
  url: string;
  caption: string | null;
  author: string;
  created_at: string;
  mine?: boolean;
};

export default function ShortsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Short[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("FIRSTLOOK");
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editedBlob, setEditedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/shorts");
      const data = (await res.json()) as { items?: Short[] };
      setItems(data.items ?? []);
    } catch {
      // 一覧取得失敗は致命的でない
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  function onPick(f?: File | null) {
    setFile(f ?? null);
    setEditedBlob(null);
    setPreviewUrl(null);
    setStatus(null);
    setError(null);
  }

  async function runAiEdit() {
    if (!file) return;
    if (!isVideoFile(file)) {
      setError("AI自動編集は動画（mp4 / mov 等）向けです。画像はそのまま投稿してください。");
      return;
    }
    setEditing(true);
    setError(null);
    setStatus("AI自動編集中…（縦型・テロップ付きショートを生成）");
    try {
      const { blob, mime } = await autoEditShortVideo(file, {
        title: title || caption || "FIRSTLOOK",
        maxSeconds: 15,
      });
      setEditedBlob(blob);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setStatus(`編集完了（${mime}）。「投稿する」で公開できます。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "自動編集に失敗しました");
      setStatus(null);
    } finally {
      setEditing(false);
    }
  }

  async function upload() {
    const payload = editedBlob
      ? new File([editedBlob], `ai-short-${Date.now()}.webm`, {
          type: editedBlob.type || "video/webm",
        })
      : file;
    if (!payload) return;
    setUploading(true);
    setError(null);
    setStatus(null);
    try {
      const body = new FormData();
      body.append("file", payload);
      body.append("caption", caption || (editedBlob ? `AI編集: ${title}` : ""));
      const res = await fetch("/api/shorts", { method: "POST", body });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          location.href = "/login?next=/shorts";
          return;
        }
        throw new Error(data.error ?? "投稿に失敗しました");
      }
      setStatus("投稿しました。");
      setFile(null);
      setEditedBlob(null);
      setPreviewUrl(null);
      setCaption("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "投稿に失敗しました");
    } finally {
      setUploading(false);
    }
  }

  async function saveEdit() {
    if (!editId) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/shorts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, caption: editCaption }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "更新に失敗しました");
      setEditId(null);
      await load();
      setStatus("キャプションを更新しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">ショート</h1>
      <p className="mt-1 text-sm text-muted">
        撮影した動画・画像を縦型ショートとして投稿。成長スタジオ（数値×音声壁打ち）と連携してSNS運用できます。
      </p>
      <div className="mt-3">
        <Button href="/growth" variant="outline">
          成長スタジオへ
        </Button>
      </div>

      <Card className="mt-6">
        <input
          ref={inputRef}
          type="file"
          accept="video/*,video/quicktime,.mov,.mp4,.m4v,.webm,image/*"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            {file ? file.name.slice(0, 28) : "動画 / 画像を選ぶ（mov可）"}
          </Button>
          <Button type="button" variant="outline" onClick={runAiEdit} disabled={!file || editing}>
            {editing ? "AI編集中..." : "AIで自動編集"}
          </Button>
          <Button type="button" onClick={upload} disabled={(!file && !editedBlob) || uploading || editing}>
            {uploading ? "投稿中..." : "投稿する"}
          </Button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="AI編集のテロップ文言"
          className="mt-3 w-full rounded-2xl border border-line px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="キャプション（任意）"
          className="mt-2 w-full rounded-2xl border border-line px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
        {previewUrl && (
          <video src={previewUrl} controls playsInline className="mt-4 aspect-[9/16] w-full max-w-xs rounded-2xl bg-black object-cover" />
        )}
        {status && <p className="mt-3 text-sm text-brand">{status}</p>}
        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {items.map((s) => (
          <div key={s.id} className="overflow-hidden rounded-2xl border border-line bg-black">
            {/\.(mp4|mov|webm|m4v)$/i.test(s.url) ? (
              <video src={s.url} controls playsInline className="aspect-[9/16] w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.url} alt={s.caption ?? "short"} className="aspect-[9/16] w-full object-cover" />
            )}
            <div className="bg-card px-3 py-2">
              <p className="truncate text-xs font-semibold">@{s.author}</p>
              {editId === s.id ? (
                <div className="mt-1 space-y-1">
                  <input
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    className="w-full rounded-lg border border-line px-2 py-1 text-xs"
                  />
                  <div className="flex gap-1">
                    <Button type="button" className="!px-3 !py-1 text-xs" onClick={saveEdit} disabled={uploading}>
                      保存
                    </Button>
                    <Button type="button" variant="outline" className="!px-3 !py-1 text-xs" onClick={() => setEditId(null)}>
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {s.caption && <p className="truncate text-xs text-muted">{s.caption}</p>}
                  {s.mine && (
                    <button
                      type="button"
                      className="mt-1 text-xs font-semibold text-brand"
                      onClick={() => {
                        setEditId(s.id);
                        setEditCaption(s.caption ?? "");
                      }}
                    >
                      編集する
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-muted">まだ投稿がありません。mov を選んで AI 自動編集してみよう。</p>
        )}
      </div>
    </AppShell>
  );
}
