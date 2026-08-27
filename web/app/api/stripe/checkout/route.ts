import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, stripeProducts } from "@/lib/stripe";
import { isStripeConfigured, siteConfig } from "@/lib/config";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe未設定です" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = (await request.json()) as {
    kind?: "future_face" | "premium" | "consult" | "coach_session";
    coachId?: string;
  };

  const kind = body.kind ?? "future_face";
  const stripe = getStripe();
  const origin = new URL(request.url).origin;

  let coachPrice = siteConfig.prices.coachSessionDefaultJpy;
  let coachAccount: string | undefined;
  if (kind === "coach_session" && body.coachId) {
    const { data: coach } = await supabase
      .from("coaches")
      .select("price_jpy, stripe_account_id, name")
      .eq("id", body.coachId)
      .maybeSingle();
    if (coach?.price_jpy) coachPrice = coach.price_jpy;
    coachAccount = coach?.stripe_account_id ?? undefined;
  }

  const product =
    kind === "premium"
      ? stripeProducts.premium
      : kind === "consult"
        ? stripeProducts.consult
        : kind === "coach_session"
          ? { name: "コーチセッション", amount: coachPrice, kind: "coach_session" as const }
          : stripeProducts.extraSim;

  const session = await stripe.checkout.sessions.create({
    mode: kind === "premium" ? "subscription" : "payment",
    customer_email: user.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: product.amount,
          product_data: { name: product.name },
          ...(kind === "premium" ? { recurring: { interval: "month" as const } } : {}),
        },
      },
    ],
    metadata: {
      userId: user.id,
      kind,
      coachId: body.coachId ?? "",
    },
    success_url: `${origin}/dashboard?paid=${kind}`,
    cancel_url: `${origin}/pricing?canceled=1`,
    ...(coachAccount
      ? {
          payment_intent_data: {
            application_fee_amount: Math.round(
              product.amount * (siteConfig.prices.platformFeePercent / 100),
            ),
            transfer_data: { destination: coachAccount },
          },
        }
      : {}),
  });

  return NextResponse.json({ url: session.url });
}
