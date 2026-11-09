"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";

const SLOTS = ["10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "18:00"];

function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAhead(n: number) {
  const out: Date[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 1; i <= n; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getDay() === 0) continue;
    out.push(d);
  }
  return out.slice(0, 10);
}

export function BookingCalendar({
  initial,
}: {
  initial: Array<{ id: string; scheduled_at: string | null; status: string }>;
}) {
  const days = useMemo(() => daysAhead(14), []);
  const [dateKey, setDateKey] = useState(days[0] ? localDateKey(days[0]) : "");
  const [slot, setSlot] = useState(SLOTS[0]);
  const [topic, setTopic] = useState<"第一印象相談" | "婚活相談">("第一印象相談");
  const [bookings, setBookings] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const scheduledAt = new Date(`${dateKey}T${slot}:00`);
      const res = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: scheduledAt.toISOString(), topic }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        booking?: { id: string; scheduled_at: string; status: string };
      };
      if (res.status === 401) {
        location.href = "/login?next=/consult";
        return;
      }
      if (!res.ok || !data.booking) throw new Error(data.error ?? "予約に失敗しました");
      setBookings((prev) => [data.booking!, ...prev]);
      setMessage("予約枠を確保しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "予約に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">相談内容</p>
        <div className="mt-2 flex gap-2">
          {(["第一印象相談", "婚活相談"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(t)}
              className={`rounded-full border px-4 py-2 text-sm ${
                t === topic ? "border-brand bg-indigo-50 text-brand" : "border-line bg-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">日付</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => {
            const key = localDateKey(d);
            const active = key === dateKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDateKey(key)}
                className={`min-w-[4.5rem] rounded-2xl border px-3 py-2 text-sm ${
                  active ? "border-brand bg-indigo-50 text-brand" : "border-line bg-white"
                }`}
              >
                {d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" })}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">時間</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SLOTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSlot(s)}
              className={`rounded-full border px-4 py-2 text-sm ${
                s === slot ? "border-brand bg-indigo-50 text-brand" : "border-line bg-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <Button type="button" onClick={submit} disabled={saving || !dateKey}>
        {saving ? "予約中..." : `${dateKey} ${slot} で予約する`}
      </Button>
      {message && <p className="text-sm text-brand">{message}</p>}
      {error && <p className="text-sm text-accent">{error}</p>}
      {bookings.length > 0 && (
        <ul className="space-y-2 text-sm text-muted">
          {bookings.map((b) => (
            <li key={b.id}>
              {b.scheduled_at
                ? new Date(b.scheduled_at).toLocaleString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "日時未定"}
              {" · "}
              {b.status === "paid" ? "決済済み" : "予約済み"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
