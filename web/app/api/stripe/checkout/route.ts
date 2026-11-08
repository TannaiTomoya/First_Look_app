import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, stripeProducts } from "@/lib/stripe";
import { isStripeConfigured, siteConfig } from "@/lib/config";
import { pricingCatalog } from "@/lib/pricing";

type CheckoutKind =
  | "future_face"
  | "premium"
  | "premium_annual"
  | "consult"
  | "coach_session";

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
    kind?: CheckoutKind;
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

  const isSub = kind === "premium" || kind === "premium_annual";
  const product =
    kind === "premium"
      ? stripeProducts.premium
      : kind === "premium_annual"
        ? stripeProducts.premiumAnnual
        : kind === "consult"
          ? stripeProducts.consult
          : kind === "coach_session"
            ? { name: "コーチセッション", amount: coachPrice, kind: "coach_session" as const }
            : stripeProducts.extraSim;

  const recurring =
    kind === "premium"
      ? { interval: "month" as const }
      : kind === "premium_annual"
        ? { interval: "year" as const }
        : undefined;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: isSub ? "subscription" : "payment",
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: product.amount,
            product_data: {
              name: product.name,
              description:
                kind === "premium"
                  ? `定価 ¥${pricingCatalog.monthly.listJpy.toLocaleString()}/月（期間限定の実質価格で請求）`
                  : kind === "premium_annual"
                    ? `定価 ¥${pricingCatalog.annual.listJpy.toLocaleString()}/年 · 初年度キャンペーン。2年目以降は継続優遇 ¥${pricingCatalog.annual.year2PlusJpy.toLocaleString()}（別枠）`
                    : kind === "consult"
                      ? `定価 ¥${pricingCatalog.consult.listJpy.toLocaleString()}（期間限定の実質価格）`
                      : undefined,
            },
            ...(recurring ? { recurring } : {}),
          },
        },
      ],
      metadata: {
        userId: user.id,
        kind,
        coachId: body.coachId ?? "",
        plan_interval: kind === "premium_annual" ? "year" : kind === "premium" ? "month" : "",
        list_amount: String("listAmount" in product ? product.listAmount ?? "" : ""),
        renewal_amount:
          kind === "premium_annual" ? String(pricingCatalog.annual.year2PlusJpy) : "",
        pricing_note:
          kind === "premium_annual"
            ? "year1_campaign_vs_year2_loyalty_separated"
            : kind === "premium"
              ? "list_kept_high_intro_via_effective_price"
              : "",
      },
      ...(isSub
        ? {
            subscription_data: {
              metadata: {
                userId: user.id,
                kind,
                plan_interval: kind === "premium_annual" ? "year" : "month",
                renewal_amount:
                  kind === "premium_annual"
                    ? String(pricingCatalog.annual.year2PlusJpy)
                    : "",
              },
            },
          }
        : {}),
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe決済を開始できませんでした" },
      { status: 400 },
    );
  }
}
