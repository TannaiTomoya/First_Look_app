"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";

const GOALS = ["婚活", "商談", "面接", "SNS"] as const;
const TONES = ["誠実", "明るい", "落ち着き"] as const;

export default function IntroPage() {
  const [form, setForm] = useState({
    name: "",
    age: "",
    job: "",
    hobby: "",
    strength: "",
    goal: "婚活" as (typeof GOALS)[number],
    tone: "誠実" as (typeof TONES)[number],
  });
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/intro/save");
        if (!res.ok) return;
        const data = (await res.json()) as { text?: string | null };
        if (data.text) setText(data.text);
      } catch {
        // 未ログイン等は無視
      }
    })();
  }, []);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setCopied(false);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/ai/intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          location.href = "/login?next=/intro";
          return;
        }
        throw new Error(data.error ?? "生成に失敗しました");
      }
      setText(data.text ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!text) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/intro/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          location.href = "/login?next=/intro";
          return;
        }
        throw new Error(data.error ?? "保存に失敗しました");
      }
      setSavedMsg("自己紹介を保存しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const input =
    "w-full rounded-2xl border border-line px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand";

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">自己紹介 自動作成</h1>
      <p className="mt-1 text-sm text-muted">婚活プロフィール・面接・商談の冒頭・SNSのbioを1分で。保存すると次回も表示されます。</p>

      <Card className="mt-6 space-y-3">
        <input className={input} placeholder="名前（ニックネーム可）*" value={form.name} onChange={(e) => set("name", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <input className={input} placeholder="年齢" value={form.age} onChange={(e) => set("age", e.target.value)} />
          <input className={input} placeholder="職業" value={form.job} onChange={(e) => set("job", e.target.value)} />
        </div>
        <input className={input} placeholder="趣味（例: サウナ、筋トレ）" value={form.hobby} onChange={(e) => set("hobby", e.target.value)} />
        <input className={input} placeholder="よく言われる強み（例: 聞き上手）" value={form.strength} onChange={(e) => set("strength", e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <Button key={g} type="button" variant={form.goal === g ? "primary" : "outline"} onClick={() => set("goal", g)}>
              {g}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <Button key={t} type="button" variant={form.tone === t ? "primary" : "outline"} onClick={() => set("tone", t)}>
              {t}
            </Button>
          ))}
        </div>
        <Button type="button" onClick={generate} disabled={loading || !form.name}>
          {loading ? "生成中..." : "自己紹介を作る"}
        </Button>
        {error && <p className="text-sm text-accent">{error}</p>}
      </Card>

      {text && (
        <Card className="mt-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full rounded-2xl border border-line bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "保存中..." : "保存する"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(text);
                setCopied(true);
              }}
            >
              {copied ? "コピーしました" : "コピー"}
            </Button>
            <Button type="button" variant="outline" onClick={generate}>
              作り直す
            </Button>
          </div>
          {savedMsg && <p className="mt-3 text-sm text-brand">{savedMsg}</p>}
        </Card>
      )}
    </AppShell>
  );
}
