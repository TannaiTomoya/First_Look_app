import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    if (secret && sig) {
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

  const supabase = await createServiceClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const kind = session.metadata?.kind ?? "future_face";
    if (!userId) return NextResponse.json({ received: true });

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

    if (kind === "premium") {
      await supabase.from("entitlements").upsert({
        user_id: userId,
        is_premium: true,
        updated_at: new Date().toISOString(),
      });
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
  }

  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated"
  ) {
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
          .update({ is_premium: false, updated_at: new Date().toISOString() })
          .eq("user_id", data.user_id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
