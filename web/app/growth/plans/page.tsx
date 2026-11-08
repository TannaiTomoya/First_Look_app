"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";

type Plan = {
  id: string;
  title: string | null;
  body: string;
  posts: Array<{ day?: number; platform?: string; hook?: string; caption?: string; cta?: string }>;
  source: string;
  created_at: string;
};

export default function GrowthPlansPage() {
  const [items, setItems] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/growth/plans");
    if (res.status === 401) {
      location.href = "/login?next=/growth/plans";
      return;
    }
    const data = (await res.json()) as { items?: Plan[]; error?: string };
    if (!res.ok) setError(data.error ?? "読み込み失敗");
    else setItems(data.items ?? []);
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  async function create() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/growth/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "第一印象・婚活の発信" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "生成失敗");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <p className="text-sm text-muted">
        <Link href="/growth" className="text-brand underline">
          成長スタジオ
        </Link>{" "}
        / 発信プラン
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold">発信プラン</h1>
      <p className="mt-1 text-sm text-muted">数値と自己紹介をもとに、2週間の投稿案を自動下書きします。</p>
      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={create} disabled={loading}>
          {loading ? "生成中..." : "プランを作る"}
        </Button>
        <Button href="/consult" variant="outline">
          丹内相談から作る
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      <div className="mt-6 space-y-4">
        {items.map((p) => (
          <Card key={p.id}>
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-2 text-sm text-muted">{p.body}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {(p.posts ?? []).map((post, i) => (
                <li key={i} className="rounded-xl bg-brand/5 px-4 py-3">
                  <span className="font-medium">
                    Day {post.day ?? i + 1} · {post.platform}
                  </span>
                  <p className="mt-1">フック: {post.hook}</p>
                  <p className="text-muted">{post.caption}</p>
                  <p className="text-xs text-brand">CTA: {post.cta}</p>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-muted">まだプランがありません。</p>}
      </div>
    </AppShell>
  );
}
