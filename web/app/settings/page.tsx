"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/config";

export default function SettingsPage() {
  const [msg, setMsg] = useState<string | null>(null);

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
    </AppShell>
  );
}
