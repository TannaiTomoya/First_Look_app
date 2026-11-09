"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button, Card } from "@/components/ui";

function SuccessInner() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [state, setState] = useState<"loading" | "ok" | "error">(sessionId ? "loading" : "ok");
  const [message, setMessage] = useState(
    sessionId ? "決済を確認しています…" : "決済を受け付けました。ダッシュボードで確認してください。",
  );

  useEffect(() => {
    if (!sessionId) return;
    fetch("/api/stripe/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "確認に失敗しました");
        setState("ok");
        setMessage("特典を反映しました。");
      })
      .catch((err: unknown) => {
        setState("error");
        setMessage(err instanceof Error ? err.message : "確認に失敗しました");
      });
  }, [sessionId]);

  return (
    <Card>
      <h1 className="text-2xl font-semibold">
        {state === "error" ? "決済の確認" : "決済を受け付けました"}
      </h1>
      <p className={`mt-2 text-sm ${state === "error" ? "text-accent" : "text-muted"}`}>
        {message}
      </p>
      <Button href="/dashboard" className="mt-6">
        ダッシュボードへ
      </Button>
      {state === "error" && (
        <Link href="/consult" className="mt-3 block text-sm text-brand">
          予約カレンダーを見る
        </Link>
      )}
    </Card>
  );
}

export default function SuccessPage() {
  return (
    <div>
      <div className="hero-grid">
        <SiteHeader />
      </div>
      <div className="mx-auto max-w-lg px-4 py-16">
        <Suspense fallback={<Card>決済を確認しています…</Card>}>
          <SuccessInner />
        </Suspense>
      </div>
      <SiteFooter />
    </div>
  );
}
