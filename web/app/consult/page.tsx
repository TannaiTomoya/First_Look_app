import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { CheckoutButton } from "@/components/checkout-button";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ConsultPage() {
  const calendly = process.env.NEXT_PUBLIC_CALENDLY_URL;
  let paid = false;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("payments")
      .select("id")
      .eq("user_id", user?.id ?? "")
      .eq("kind", "consult")
      .eq("status", "paid")
      .limit(1)
      .maybeSingle();
    paid = Boolean(data);
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">個別相談</h1>
      <p className="mt-1 text-sm text-muted">決済後に日程を選びます。</p>
      <Card className="mt-6">
        {paid && calendly ? (
          <iframe
            title="Calendly"
            src={calendly}
            className="h-[700px] w-full rounded-2xl border-0"
          />
        ) : paid && !calendly ? (
          <p className="text-sm text-muted">
            決済は完了しています。Calendly URL（NEXT_PUBLIC_CALENDLY_URL）設定後に予約枠が表示されます。
          </p>
        ) : (
          <div>
            <p className="text-sm text-muted">相談料のお支払い後、予約カレンダーが開きます。</p>
            <div className="mt-4">
              <CheckoutButton kind="consult" label="相談を決済する" />
            </div>
            <Button href="/coaches" variant="outline" className="ml-2 mt-4">
              コーチ一覧
            </Button>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
