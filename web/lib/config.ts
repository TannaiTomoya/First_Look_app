export const siteConfig = {
  name: "FirstLook",
  tagline: "話す前に、自分を否定しないための5分",
  description:
    "失敗できない場面の前に、第一印象を整える。写真を撮るだけで変化を記録・分析・加速させるAI Look Tracker。",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  prices: {
    extraSimJpy: 500,
    premiumMonthlyJpy: 980,
    consultJpy: 4980,
    coachSessionDefaultJpy: 5000,
    platformFeePercent: 15,
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
