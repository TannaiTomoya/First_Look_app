"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export type CheckoutKind =
  | "future_face"
  | "premium"
  | "premium_annual"
  | "consult"
  | "coach_session";

export function CheckoutButton({
  kind,
  coachId,
  label,
  variant = "primary",
  className,
}: {
  kind: CheckoutKind;
  coachId?: string;
  label: string;
  variant?: "primary" | "accent" | "outline" | "light";
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, coachId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.status === 401) {
        const next = encodeURIComponent(
          `${window.location.pathname}${window.location.search}`,
        );
        window.location.href = `/login?next=${next}`;
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "決済を開始できませんでした");
    } catch {
      setError("決済の接続に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-1">
      <Button type="button" variant={variant} className={className} onClick={start} disabled={loading}>
        {loading ? "準備中..." : label}
      </Button>
      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}
