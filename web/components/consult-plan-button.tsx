"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function ConsultPlanButton({ consultationId }: { consultationId?: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/growth/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultation_id: consultationId,
          topic: "婚活相談・第一印象の発信",
        }),
      });
      const data = (await res.json()) as { error?: string; plan?: { id: string } };
      if (!res.ok) {
        if (res.status === 401) {
          location.href = "/login?next=/consult";
          return;
        }
        throw new Error(data.error ?? "生成に失敗しました");
      }
      setMsg("発信プランを作成しました。");
      location.href = "/growth/plans";
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button type="button" onClick={run} disabled={loading}>
        {loading ? "プラン生成中..." : "相談後の発信プランを作る"}
      </Button>
      {msg && <p className="mt-2 text-sm text-brand">{msg}</p>}
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
    </div>
  );
}
