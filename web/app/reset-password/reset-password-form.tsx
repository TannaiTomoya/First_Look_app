"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/site-header";
import { Button, Card } from "@/components/ui";
import { authErrorView } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("確認用のパスワードが一致しません。");
      return;
    }
    setLoading(true);
    const { error: err } = await createClient().auth.updateUser({ password });
    if (err) {
      setError(authErrorView(err).message);
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  const inputCls =
    "w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>
      <Card>
        <h1 className="text-2xl font-semibold">新しいパスワード</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新しいパスワード（8文字以上）"
            className={inputCls}
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="もう一度入力"
            className={inputCls}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "保存中..." : "保存してホームへ"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-accent">
              {error}
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
