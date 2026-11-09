import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { getEntitlements } from "@/lib/entitlements";
import { futureFaceUpgradeMessage, getFutureFaceAccess } from "@/lib/future-face/access";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import FutureFaceLoader from "./loader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Future Face",
  robots: { index: false },
};

export default async function FutureFacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const ent = user
    ? await getEntitlements(await createServiceClient(), user.id)
    : { isPremium: false, isAnnual: false };

  return (
    <AppShell isAdmin={profile?.role === "admin"}>
      <FutureFaceLoader access={getFutureFaceAccess(ent)} upgradeMessage={futureFaceUpgradeMessage(ent)} />
    </AppShell>
  );
}
