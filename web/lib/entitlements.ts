import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanInterval } from "@/lib/pricing";

export type Entitlements = {
  extraSimulations: number;
  isPremium: boolean;
  planInterval: PlanInterval;
  planRenewals: number;
  isAnnual: boolean;
};

export async function getEntitlements(
  supabase: SupabaseClient,
  userId: string,
): Promise<Entitlements> {
  const full = await supabase
    .from("entitlements")
    .select("extra_simulations, is_premium, plan_interval, plan_renewals")
    .eq("user_id", userId)
    .maybeSingle();

  let data = full.data as {
    extra_simulations?: number;
    is_premium?: boolean;
    plan_interval?: string;
    plan_renewals?: number;
  } | null;

  if (full.error) {
    const legacy = await supabase
      .from("entitlements")
      .select("extra_simulations, is_premium")
      .eq("user_id", userId)
      .maybeSingle();
    data = legacy.data;
  }

  const planInterval = (data?.plan_interval as PlanInterval | undefined) ?? "none";
  const isPremium =
    Boolean(data?.is_premium) || planInterval === "month" || planInterval === "year";

  return {
    extraSimulations: data?.extra_simulations ?? 0,
    isPremium,
    planInterval: isPremium && planInterval === "none" ? "month" : planInterval,
    planRenewals: data?.plan_renewals ?? 0,
    isAnnual: planInterval === "year",
  };
}
