import { pricingCatalog } from "@/lib/pricing";

export const siteConfig = {
  name: "FirstLook",
  tagline: "話す前に、自分を否定しないための5分",
  description:
    "失敗できない場面の前に、第一印象を整える。写真を撮るだけで変化を記録・分析・加速させるAI Look Tracker。",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  prices: {
    /** @deprecated use pricingCatalog.monthly.introJpy — kept for legacy refs */
    premiumMonthlyJpy: pricingCatalog.monthly.introJpy,
    premiumMonthlyListJpy: pricingCatalog.monthly.listJpy,
    premiumAnnualYear1Jpy: pricingCatalog.annual.year1Jpy,
    premiumAnnualYear2Jpy: pricingCatalog.annual.year2PlusJpy,
    premiumAnnualListJpy: pricingCatalog.annual.listJpy,
    extraSimJpy: 500,
    consultJpy: pricingCatalog.consult.introJpy,
    consultListJpy: pricingCatalog.consult.listJpy,
    coachSessionDefaultJpy: pricingCatalog.coachDefaultJpy,
    platformFeePercent: pricingCatalog.platformFeePercent,
  },
};

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isStripeConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
      process.env.STRIPE_SECRET_KEY,
  );
}
