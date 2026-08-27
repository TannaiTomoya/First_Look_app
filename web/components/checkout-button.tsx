"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function CheckoutButton({
  kind,
  coachId,
  label,
  variant = "primary",
}: {
  kind: "future_face" | "premium" | "consult" | "coach_session";
  coachId?: string;
  label: string;
  variant?: "primary" | "accent" | "outline";
}) {
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, coachId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      alert(data.error ?? "決済を開始できませんでした");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant={variant} onClick={start} disabled={loading}>
      {loading ? "準備中..." : label}
    </Button>
  );
}
