import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { fulfillCheckoutSession } from "@/lib/fulfill-checkout";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    if (secret && sig && !secret.includes("...")) {
      event = stripe.webhooks.constructEvent(body, sig, secret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid payload" },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    await fulfillCheckoutSession(event.data.object as Stripe.Checkout.Session);
  }

  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated"
  ) {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceClient();
    const sub = event.data.object as Stripe.Subscription;
    const status = sub.status === "active" || sub.status === "trialing" ? "active" : sub.status;
    const periodEnd = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
    await supabase
      .from("subscriptions")
      .update({
        status,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", sub.id);

    if (status !== "active") {
      const { data } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", sub.id)
        .maybeSingle();
      if (data?.user_id) {
        await supabase
          .from("entitlements")
          .update({
            is_premium: false,
            plan_interval: "none",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", data.user_id);
      }
    } else {
      // 更新成功時: 年額の継続回数を増やせる場合は metadata から推定
      const interval = sub.metadata?.plan_interval;
      const { data } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", sub.id)
        .maybeSingle();
      if (data?.user_id && (interval === "month" || interval === "year")) {
        await supabase
          .from("entitlements")
          .update({
            is_premium: true,
            plan_interval: interval,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", data.user_id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
