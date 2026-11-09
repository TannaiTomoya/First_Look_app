"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/config";
import { countSnapshots, deleteAllSnapshots, getConsent, setConsent } from "@/lib/face-mesh/snapshots";

export default function SettingsPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [consent, setConsentState] = useState<boolean | null>(null);
  const [count, setCount] = useState(0);
  const [faceMsg, setFaceMsg] = useState<string | null>(null);

  function refreshFace() {
    const supabase = createClient();
    return Promise.all([getConsent(supabase), countSnapshots(supabase)]).then(([c, n]) => {
      setConsentState(c);
      setCount(n);
    });
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    Promise.all([getConsent(supabase), countSnapshots(supabase)])
      .then(([c, n]) => {
        setConsentState(c);
        setCount(n);
      })
      .catch(() => setFaceMsg("読み込みに失敗しました"));
  }, []);

  async function faceAction(action: () => Promise<void>, done: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    try {
      await action();
      await refreshFace();
      setFaceMsg(done);
    } catch (err) {
      setFaceMsg(err instanceof Error ? err.message : "失敗しました");
    }
  }

  async function portal() {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) location.href = data.url;
    else setMsg(data.error ?? "ポータルを開けませんでした");
  }

  async function logout() {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    location.href = "/";
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">設定</h1>
      <Card className="mt-6 space-y-3">
        <p className="text-sm text-muted">サブスクの解約・支払い方法は Stripe ポータルで管理します。</p>
        <Button type="button" variant="outline" onClick={portal}>
          課金ポータルを開く
        </Button>
        <Button type="button" variant="ghost" onClick={logout}>
          ログアウト
        </Button>
        {msg && <p className="text-sm text-accent">{msg}</p>}
      </Card>

      <Card className="mt-4 space-y-3">
        <h2 className="font-semibold">顔の構造データ</h2>
        <p className="text-sm text-muted">
          写真から算出した顎幅・頬幅・顔の縦横比・顔の向きの数値です。本人以外（運営を含む）は閲覧できません。
        </p>
        {consent !== null && (
          <p className="text-sm">
            記録: {consent ? "同意済み" : "停止中"} · 保存件数 {count} 件
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {consent === false && (
            <Button
              type="button"
              variant="outline"
              onClick={() => faceAction(() => setConsent(createClient(), true), "記録を開始しました")}
            >
              同意して記録を始める
            </Button>
          )}
          {consent === true && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                faceAction(
                  () => setConsent(createClient(), false),
                  "同意を取り消し、保存済みのデータをすべて削除しました",
                  "同意を取り消すと、保存済みの構造データがすべて削除されます。よろしいですか？",
                )
              }
            >
              同意を取り消して全削除
            </Button>
          )}
          {count > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                faceAction(
                  () => deleteAllSnapshots(createClient()),
                  "構造データをすべて削除しました",
                  "保存済みの構造データをすべて削除します。よろしいですか？",
                )
              }
            >
              データだけ全削除
            </Button>
          )}
        </div>
        {faceMsg && <p className="text-sm text-brand">{faceMsg}</p>}
      </Card>
    </AppShell>
  );
}
