import type { SupabaseClient } from "@supabase/supabase-js";

export async function getEntitlements(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data } = await supabase
    .from("entitlements")
    .select("extra_simulations, is_premium")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    extraSimulations: data?.extra_simulations ?? 0,
    isPremium: Boolean(data?.is_premium),
  };
}
