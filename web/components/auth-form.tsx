"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/config";
import { authErrorView, callbackErrorView, type AuthErrorView } from "@/lib/auth/errors";
import { safeNext } from "@/lib/auth/safe-next";
import { Button, Card } from "@/components/ui";
import { Logo } from "@/components/site-header";

/** 確認メール・OAuth の戻り先。ビルド時の env ではなく、今開いているサイトの origin を使う */
export function callbackUrl(next: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<AuthErrorView | null>(() =>
    callbackErrorView(searchParams.get("error")),
  );
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
    setNotice(null);
    setFailure(null);
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callbackUrl(next) },
        });
        if (error) throw error;
        // メール確認が不要な設定ならそのままセッションが返る
        if (data.session) {
          location.href = next;
          return;
        }
        setNotice("確認メールを送信しました。メール内のリンクを、このブラウザで開いてください。");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.href = next;
        return;
      }
    } catch (err) {
      setFailure(authErrorView(err));
    }
    setLoading(false);
  }

  async function resendConfirmation() {
    if (!email) {
      setFailure({ message: "メールアドレスを入力してから、もう一度押してください。" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callbackUrl(next) },
    });
    setLoading(false);
    if (error) {
      setFailure(authErrorView(error));
      return;
    }
    setFailure(null);
    setNotice("確認メールを再送しました。メール内のリンクを、このブラウザで開いてください。");
  }

  async function signInWithGoogle() {
    setLoading(true);
    setNotice(null);
    setFailure(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl(next),
        queryParams: { prompt: "select_account" },
      },
    });
    // 成功時は Google へ遷移するので、ここに来るのは失敗時のみ
    if (error) {
      setFailure(authErrorView(error));
      setLoading(false);
    }
  }

  const forgotHref = `/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`;

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
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード（8文字以上）"
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "処理中..." : mode === "login" ? "ログイン" : "登録する"}
          </Button>
        </form>
        {mode === "login" && (
          <p className="mt-3 text-right text-sm">
            <Link href={forgotHref} className="text-brand">
              パスワードを忘れた方
            </Link>
          </p>
        )}
        <div className="mt-4 grid gap-2">
          <Button type="button" variant="outline" className="w-full" onClick={signInWithGoogle} disabled={loading}>
            Googleで続ける
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full opacity-60"
            disabled
            title="Supabase の LINE OIDC 設定後に有効になります"
          >
            LINEで続ける（準備中）
          </Button>
        </div>

        {notice && (
          <p role="status" className="mt-4 text-sm text-brand">
            {notice}
          </p>
        )}
        {failure && (
          <div role="alert" className="mt-4 space-y-2 text-sm text-accent">
            <p>{failure.message}</p>
            {failure.action === "reset-password" && (
              <Link href={forgotHref} className="inline-block font-semibold underline">
                パスワードを再設定する
              </Link>
            )}
            {failure.action === "resend-confirmation" && (
              <button
                type="button"
                onClick={resendConfirmation}
                disabled={loading}
                className="font-semibold underline"
              >
                確認メールを再送する
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
