import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { CheckoutButton } from "@/components/checkout-button";
import { isSupabaseConfigured } from "@/lib/config";
import { getEntitlements } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";

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

  const entitlements = user
    ? await getEntitlements(supabase, user.id)
    : { extraSimulations: 0, isPremium: false };

  const { data: latest } = await supabase
    .from("look_records")
    .select("id, created_at, photo_path")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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

      <Card className="mt-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-brand">プレミアム</p>
            <p className="mt-1 font-semibold">
              {entitlements.isPremium
                ? "Premium 有効"
                : `追加パターン残 ${entitlements.extraSimulations} 回`}
            </p>
            <p className="mt-1 text-sm text-muted">
              シミュレーション結果の直後に、比較したいときだけ課金。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CheckoutButton kind="future_face" label="¥500 追加" variant="outline" />
            {!entitlements.isPremium && (
              <CheckoutButton kind="premium" label="月額¥980" variant="accent" />
            )}
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
