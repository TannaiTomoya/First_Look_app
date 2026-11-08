import Stripe from "stripe";
import { pricingCatalog } from "@/lib/pricing";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  // Cloudflare Workers では Node の http が使えないため fetch ベースを明示
  return new Stripe(key, {
    typescript: true,
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export const stripeProducts = {
  extraSim: {
    name: "Future Face 追加パターン",
    amount: 500,
    kind: "future_face" as const,
  },
  premium: {
    name: "FirstLook Premium 月額（期間限定価格）",
    amount: pricingCatalog.monthly.introJpy,
    listAmount: pricingCatalog.monthly.listJpy,
    kind: "premium" as const,
    interval: "month" as const,
  },
  premiumAnnual: {
    name: "FirstLook Premium 年額（初年度キャンペーン）",
    amount: pricingCatalog.annual.year1Jpy,
    listAmount: pricingCatalog.annual.listJpy,
    renewalAmount: pricingCatalog.annual.year2PlusJpy,
    kind: "premium_annual" as const,
    interval: "year" as const,
  },
  consult: {
    name: pricingCatalog.consult.name,
    amount: pricingCatalog.consult.introJpy,
    listAmount: pricingCatalog.consult.listJpy,
    kind: "consult" as const,
  },
};
