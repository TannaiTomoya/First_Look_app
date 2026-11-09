import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { isStripeConfigured } from "@/lib/config";
import { fulfillCheckoutSession } from "@/lib/fulfill-checkout";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe未設定です" }, { status: 400 });
  }

  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { sessionId } = (await request.json()) as { sessionId?: string };
  if (!sessionId) {
    return NextResponse.json({ error: "session_id がありません" }, { status: 400 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.userId && session.metadata.userId !== user.id) {
    return NextResponse.json({ error: "決済の所有者が一致しません" }, { status: 403 });
  }
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return NextResponse.json({ error: "まだ決済が完了していません" }, { status: 400 });
  }

  await fulfillCheckoutSession(session);
  return NextResponse.json({ ok: true });
}
