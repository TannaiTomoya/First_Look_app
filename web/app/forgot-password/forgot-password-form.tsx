"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { callbackUrl } from "@/components/auth-form";
import { Logo } from "@/components/site-header";
import { Button, Card } from "@/components/ui";
import { authErrorView } from "@/lib/auth/errors";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    setError(null);
    const { error: err } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl("/reset-password"),
    });
    setLoading(false);
    if (err) {
      setError(authErrorView(err).message);
      return;
    }
    // 登録の有無は明かさない（アカウントの存在確認に使われるのを防ぐ）
    setSent(true);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>
      <Card>
        <h1 className="text-2xl font-semibold">パスワードを再設定</h1>
        {sent ? (
          <p role="status" className="mt-4 text-sm">
            登録済みのメールアドレスであれば、再設定用のリンクを送りました。
            <br />
            メール内のリンクを、<strong>このブラウザで</strong>開いてください。届かない場合は迷惑メールフォルダも確認してください。
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <p className="text-sm text-muted">登録したメールアドレスに、再設定用のリンクを送ります。</p>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "送信中..." : "再設定リンクを送る"}
            </Button>
            {error && (
              <p role="alert" className="text-sm text-accent">
                {error}
              </p>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}
