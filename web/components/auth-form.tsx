"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/config";
import { Button, Card } from "@/components/ui";
import { Logo } from "@/components/site-header";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <Card className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold">接続設定が未完了です</h1>
        <p className="mt-2 text-sm text-muted">
          `web/.env.local` に NEXT_PUBLIC_SUPABASE_URL と ANON KEY を入れて再起動してください。
        </p>
      </Card>
    );
  }

  const supabase = createClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback?next=${next}` },
        });
        if (error) throw error;
        setMessage("確認メールを送信しました。メール内のリンクを開いてください。");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.href = next;
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function oauth(provider: "google" | "line") {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${next}` },
    });
    if (error) {
      setMessage(
        provider === "line"
          ? "LINEログインは Supabase のカスタムOIDC設定後に有効になります。"
          : error.message,
      );
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>
      <Card>
        <h1 className="text-2xl font-semibold">
          {mode === "login" ? "ログイン" : "無料ではじめる"}
        </h1>
        <p className="mt-1 text-sm text-muted">使う人を、安全につなぐ。</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード（8文字以上）"
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "処理中..." : mode === "login" ? "ログイン" : "登録する"}
          </Button>
        </form>
        <div className="mt-4 grid gap-2">
          <Button type="button" variant="outline" className="w-full" onClick={() => oauth("google")}>
            Googleで続ける
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => oauth("line")}>
            LINEで続ける
          </Button>
        </div>
        {message && <p className="mt-4 text-sm text-accent">{message}</p>}
      </Card>
    </div>
  );
}
