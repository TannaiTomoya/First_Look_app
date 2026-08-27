"use client";

import { useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { CheckoutButton } from "@/components/checkout-button";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

export default function CapturePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function onFile(f?: File) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function save() {
    if (!file) return;
    if (!isSupabaseConfigured()) {
      setStatus("Supabase未設定です");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインが必要です");

      const { count } = await supabase
        .from("look_records")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("looks").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("look_records").insert({
        user_id: user.id,
        photo_path: path,
        note,
        is_day0: (count ?? 0) === 0,
      });
      if (insErr) throw insErr;

      setStatus("保存しました。記録タブで確認できます。");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">今日の1枚</h1>
      <p className="mt-1 text-sm text-muted">カメラまたはアルバムから。1日1分。</p>

      <Card className="mt-6">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[3/4] w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-white"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm text-muted">写真を選択</span>
          )}
        </button>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="メモ（任意）"
          className="mt-4 w-full rounded-2xl border border-line px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={!file || saving}>
            {saving ? "保存中..." : "記録する"}
          </Button>
          <CheckoutButton kind="future_face" label="追加パターン ¥500" variant="outline" />
        </div>
        {status && <p className="mt-3 text-sm text-muted">{status}</p>}
      </Card>
    </AppShell>
  );
}
