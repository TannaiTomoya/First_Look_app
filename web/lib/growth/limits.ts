import type { SupabaseClient } from "@supabase/supabase-js";
import { getEntitlements } from "@/lib/entitlements";

export function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type GrowthLimits = {
  isPremium: boolean;
  isAnnual: boolean;
  coachLimit: number; // -1 = unlimited
  clipLimit: number;
  maxRecordingSec: number;
  coachUsed: number;
  clipUsed: number;
  /** 年額限定 */
  youtubeImport: boolean;
  allClipTemplates: boolean;
  unlimitedPlans: boolean;
};

export async function getGrowthLimits(
  admin: SupabaseClient,
  userId: string,
): Promise<GrowthLimits> {
  const ent = await getEntitlements(admin, userId);
  const key = monthKey();
  const { data } = await admin
    .from("growth_usage")
    .select("coach_count, clip_count")
    .eq("user_id", userId)
    .eq("month_key", key)
    .maybeSingle();

  const used = {
    coachUsed: data?.coach_count ?? 0,
    clipUsed: data?.clip_count ?? 0,
  };

  if (ent.isAnnual) {
    return {
      isPremium: true,
      isAnnual: true,
      coachLimit: -1,
      clipLimit: 100,
      maxRecordingSec: 3600,
      youtubeImport: true,
      allClipTemplates: true,
      unlimitedPlans: true,
      ...used,
    };
  }

  if (ent.isPremium) {
    return {
      isPremium: true,
      isAnnual: false,
      coachLimit: -1,
      clipLimit: 50,
      maxRecordingSec: 3600,
      youtubeImport: false,
      allClipTemplates: false,
      unlimitedPlans: false,
      ...used,
    };
  }

  return {
    isPremium: false,
    isAnnual: false,
    coachLimit: 3,
    clipLimit: 3,
    maxRecordingSec: 180,
    youtubeImport: false,
    allClipTemplates: false,
    unlimitedPlans: false,
    ...used,
  };
}

export async function bumpUsage(
  admin: SupabaseClient,
  userId: string,
  field: "coach_count" | "clip_count",
  by = 1,
) {
  try {
    const key = monthKey();
    const { data } = await admin
      .from("growth_usage")
      .select("coach_count, clip_count")
      .eq("user_id", userId)
      .eq("month_key", key)
      .maybeSingle();

    const next = {
      user_id: userId,
      month_key: key,
      coach_count: (data?.coach_count ?? 0) + (field === "coach_count" ? by : 0),
      clip_count: (data?.clip_count ?? 0) + (field === "clip_count" ? by : 0),
    };
    await admin.from("growth_usage").upsert(next, { onConflict: "user_id,month_key" });
  } catch {
    // テーブル未作成時はスキップ
  }
}

export function assertCoachAllowed(limits: GrowthLimits): string | null {
  if (limits.coachLimit < 0) return null;
  if (limits.coachUsed >= limits.coachLimit) {
    return `無料枠は月${limits.coachLimit}回までです。Premiumで無制限になります。`;
  }
  return null;
}

export function assertClipAllowed(limits: GrowthLimits): string | null {
  if (limits.clipUsed >= limits.clipLimit) {
    return `今月のクリップ生成上限（${limits.clipLimit}本）に達しています。${
      limits.isAnnual
        ? "来月までお待ちください。"
        : limits.isPremium
          ? "年額プランで月100本まで拡張できます。"
          : "Premiumで月50本、年額で月100本まで。"
    }`;
  }
  return null;
}

export function assertRecordingDuration(limits: GrowthLimits, sec: number): string | null {
  if (sec > limits.maxRecordingSec) {
    return `録画が長すぎます（上限 ${limits.maxRecordingSec}秒）。${
      limits.isPremium ? "" : "Premiumで最大60分まで。"
    }`;
  }
  return null;
}

export function assertYoutubeImport(limits: GrowthLimits): string | null {
  if (limits.youtubeImport) return null;
  return "YouTube統計インポートは年額Premiumの特典です。";
}

export function assertUnlimitedPlans(limits: GrowthLimits, planCountThisMonth: number): string | null {
  if (limits.unlimitedPlans) return null;
  if (!limits.isPremium) {
    return "発信プランAIはPremium以上で利用できます。年額なら無制限です。";
  }
  if (planCountThisMonth >= 1) {
    return "月額Premiumの発信プランは月1回まで。年額で無制限になります。";
  }
  return null;
}

export function assertTemplateAllowed(limits: GrowthLimits, templateKey: string): string | null {
  if (limits.allClipTemplates) return null;
  if (templateKey === "standard_15") return null;
  if (!limits.isPremium) {
    return "このテンプレはPremium以上です。A/B/C全開放は年額特典。";
  }
  return "切り抜きテンプレの全開放は年額Premiumの特典です（月額は標準15秒のみ）。";
}
