import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

export async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const kind = session.metadata?.kind ?? "future_face";
  if (!userId) return { ok: false as const, reason: "no_user" };

  const supabase = await createServiceClient();
  const { data: existing } = await supabase
    .from("payments")
    .select("id, status")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (existing?.status === "paid") return { ok: true as const, already: true };

  await supabase.from("payments").upsert(
    {
      user_id: userId,
      stripe_session_id: session.id,
      amount: session.amount_total ?? 0,
      currency: session.currency ?? "jpy",
      kind,
      status: "paid",
      metadata: session.metadata ?? {},
    },
    { onConflict: "stripe_session_id" },
  );

  if (kind === "future_face") {
    const { data } = await supabase
      .from("entitlements")
      .select("extra_simulations")
      .eq("user_id", userId)
      .maybeSingle();
    await supabase.from("entitlements").upsert({
      user_id: userId,
      extra_simulations: (data?.extra_simulations ?? 0) + 1,
      updated_at: new Date().toISOString(),
    });
  }

  if (kind === "premium" || kind === "premium_annual") {
    const planInterval = kind === "premium_annual" ? "year" : "month";
    const payload = {
      user_id: userId,
      is_premium: true,
      plan_interval: planInterval,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("entitlements").upsert(payload);
    if (error) {
      // 0008 未適用時は旧カラムのみ
      await supabase.from("entitlements").upsert({
        user_id: userId,
        is_premium: true,
        updated_at: new Date().toISOString(),
      });
    }
    if (session.subscription) {
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_subscription_id: String(session.subscription),
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" },
      );
    }
  }

  if (kind === "consult" || kind === "coach_session") {
    await supabase.from("consultations").insert({
      user_id: userId,
      coach_id: session.metadata?.coachId || null,
      status: "paid",
    });
  }

  return { ok: true as const, already: false };
}
