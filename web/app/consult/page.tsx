import { AppShell } from "@/components/app-shell";
import { BookingCalendar } from "@/components/booking-calendar";
import { ConsultPlanButton } from "@/components/consult-plan-button";
import { Card } from "@/components/ui";
import { CheckoutButton } from "@/components/checkout-button";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ConsultPage() {
  const calendly = process.env.NEXT_PUBLIC_CALENDLY_URL;
  let bookings: Array<{ id: string; scheduled_at: string | null; status: string }> = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const admin = await createServiceClient();
      const { data } = await admin
        .from("consultations")
        .select("id, scheduled_at, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      bookings = data ?? [];
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">個別相談</h1>
      <p className="mt-1 text-sm text-muted">空き枠から日程を選びます。有料相談は決済後に確定します。</p>

      <Card className="mt-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 font-display text-xl font-bold text-brand">
            丹内
          </div>
          <div>
            <h2 className="text-lg font-semibold">丹内 智弥</h2>
            <p className="text-sm text-muted">第一印象・婚活の個別相談を担当</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          記録した写真・肌チェックの結果をもとに、「次の一手」を一緒に決めます。婚活相談では、プロフィール写真の選定・自己紹介文の添削・岩手県内のイベント選びまで伴走します。
        </p>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold">予約カレンダー</h2>
        <p className="mt-1 text-sm text-muted">第一印象相談 / 婚活相談 を選んで、日曜以外の10日分から予約できます。</p>
        <div className="mt-4">
          <BookingCalendar initial={bookings} />
        </div>
      </Card>
      <Card className="mt-4">
        <h2 className="font-semibold">相談後の発信プラン（Phase 2）</h2>
        <p className="mt-1 text-sm text-muted">
          数値と自己紹介をもとに、2週間のショート/Reels案を自動下書きします。
        </p>
        <div className="mt-4">
          <ConsultPlanButton consultationId={bookings[0]?.id} />
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold">有料相談 ¥4,980</h2>
        <p className="mt-1 text-sm text-muted">決済すると予約が「決済済み」になります。</p>
        <div className="mt-4">
          <CheckoutButton kind="consult" label="相談を決済する" />
        </div>
        {calendly ? (
          <iframe
            title="Calendly"
            src={calendly}
            className="mt-6 h-[700px] w-full rounded-2xl border-0"
          />
        ) : null}
      </Card>
    </AppShell>
  );
}
