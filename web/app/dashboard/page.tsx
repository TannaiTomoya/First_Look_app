import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { CheckoutButton } from "@/components/checkout-button";
import { isSupabaseConfigured } from "@/lib/config";
import { getEntitlements } from "@/lib/entitlements";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <AppShell>
        <Card>
          <h1 className="text-xl font-semibold">Supabase未設定</h1>
          <p className="mt-2 text-sm text-muted">web/.env.local を設定してください。</p>
        </Card>
      </AppShell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, onboarding_completed")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const admin = user ? await createServiceClient() : null;
  const entitlements = user
    ? await getEntitlements(admin ?? supabase, user.id)
    : { extraSimulations: 0, isPremium: false, planInterval: "none" as const, planRenewals: 0, isAnnual: false };

  const latest = user && admin
    ? (
        await admin
          .from("look_records")
          .select("id, created_at, photo_path")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data
    : null;

  const today = new Date().toISOString().slice(0, 10);
  const { data: action } = await supabase
    .from("daily_actions")
    .select("title, completed")
    .eq("user_id", user?.id ?? "")
    .eq("action_date", today)
    .maybeSingle();

  return (
    <AppShell isAdmin={profile?.role === "admin"}>
      <p className="text-sm text-muted">今日の5分</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">
        {profile?.display_name ?? "あなた"}の記録
      </h1>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <p className="text-sm text-brand">Daily Loop</p>
          <h2 className="mt-2 text-xl font-semibold">
            {action?.title ?? "眉・肌・髪型を1分チェック"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {action?.completed ? "本日は完了しています" : "迷わず、これだけやる"}
          </p>
          <Button href="/capture" className="mt-5">
            今日の1枚を撮る
          </Button>
        </Card>
        <Card>
          <p className="text-sm text-brand">最新の記録</p>
          <p className="mt-2 text-muted">
            {latest
              ? new Date(latest.created_at).toLocaleString("ja-JP")
              : "まだ写真がありません"}
          </p>
          <Button href="/records" variant="outline" className="mt-5">
            タイムラインを見る
          </Button>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="font-display text-xl font-semibold">ツール</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { href: "/future-face", t: "Future Face", d: "輪郭・肌を3Dでシミュレーション" },
            { href: "/growth", t: "成長スタジオ", d: "数値分析×音声壁打ち" },
            { href: "/skin", t: "美肌診断", d: "顔写真をAI診断→記録" },
            { href: "/skin-check", t: "5分肌チェック", d: "ステップ式フィードバック" },
            { href: "/physiognomy", t: "人相AI", d: "第一印象リーディング" },
            { href: "/beauty-info", t: "美容情報", d: "メンズ習慣タイムライン" },
            { href: "/konkatsu", t: "婚活チャレンジ", d: "岩手のイベント情報" },
            { href: "/shorts", t: "ショート", d: "AI自動編集・投稿" },
            { href: "/intro", t: "自己紹介作成", d: "生成して保存" },
            { href: "/consult", t: "個別相談", d: "丹内 智弥に相談" },
          ].map((x) => (
            <a
              key={x.href}
              href={x.href}
              className="rounded-2xl border border-line bg-card p-4 transition hover:border-brand hover:shadow-md"
            >
              <p className="font-semibold">{x.t}</p>
              <p className="mt-1 text-xs text-muted">{x.d}</p>
            </a>
          ))}
        </div>
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-brand">プラン</p>
            <p className="mt-1 font-semibold">
              {entitlements.isAnnual
                ? "Premium 年額（高度機能開放）"
                : entitlements.isPremium
                  ? "Premium 月額"
                  : "無料 / 成長の入口"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {entitlements.isAnnual
                ? "YouTube取込・全テンプレ・発信プラン無制限が有効です。"
                : entitlements.isPremium
                  ? "年額にすると高度AI拡張が開放されます。安さより回収速度で。"
                  : "継続が成果を生む。定価は維持し、年額で自己投資する。"}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-56">
            {!entitlements.isPremium && (
              <CheckoutButton kind="premium" label="月額ではじめる" variant="outline" />
            )}
            {!entitlements.isAnnual && (
              <CheckoutButton kind="premium_annual" label="年額で投資する" />
            )}
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
