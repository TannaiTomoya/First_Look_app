import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key, { typescript: true });
}

export const stripeProducts = {
  extraSim: {
    name: "Future Face 追加パターン",
    amount: 500,
    kind: "future_face" as const,
  },
  premium: {
    name: "FirstLook Premium",
    amount: 980,
    kind: "premium" as const,
  },
  consult: {
    name: "個別相談（Calendly予約）",
    amount: 4980,
    kind: "consult" as const,
  },
};
