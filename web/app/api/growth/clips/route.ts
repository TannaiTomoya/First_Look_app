import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { generateAiObject } from "@/lib/ai";
import { assertClipAllowed, assertTemplateAllowed, bumpUsage, getGrowthLimits } from "@/lib/growth/limits";

export const dynamic = "force-dynamic";

const MAX_SIZE = 80 * 1024 * 1024;

const CaptionSchema = z.object({
  caption: z.string().min(1).max(200),
  hashtags: z.array(z.string()).min(1).max(8),
  platform_hint: z.enum(["reels", "shorts", "tiktok"]),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const admin = await createServiceClient();
  const { data, error } = await admin
    .from("growth_clips")
    .select("id, recording_id, highlight_id, storage_path, caption, hashtags, platform_hint, short_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({ items: [], needsMigration: true });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const { data: pub } = admin.storage.from("growth").getPublicUrl("x");
  const base = pub.publicUrl.replace(/\/x$/, "");
  return NextResponse.json({
    items: (data ?? []).map((c) => ({ ...c, url: `${base}/${c.storage_path}` })),
  });
}

/** 生成済みクリップBlobを保存。任意で shorts 公開 + キャプション生成 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const recordingId = String(form.get("recording_id") ?? "") || null;
  const highlightId = String(form.get("highlight_id") ?? "") || null;
  const title = String(form.get("title") ?? "FIRSTLOOK").slice(0, 80);
  const reason = String(form.get("reason") ?? "");
  const publishShort = String(form.get("publish_short") ?? "1") !== "0";
  const templateKey = String(form.get("template_key") ?? "standard_15");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "クリップ動画がありません" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "クリップが大きすぎます" }, { status: 400 });
  }

  const admin = await createServiceClient();
  const limits = await getGrowthLimits(admin, user.id);
  const blocked = assertClipAllowed(limits);
  if (blocked) return NextResponse.json({ error: blocked, limits }, { status: 402 });
  const tplErr = assertTemplateAllowed(limits, templateKey);
  if (tplErr) return NextResponse.json({ error: tplErr, upgrade: "premium_annual" }, { status: 403 });
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === "growth")) {
    await admin.storage.createBucket("growth", { public: true });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "webm";
  const path = `${user.id}/clip-${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("growth")
    .upload(path, file, { contentType: file.type || "video/webm", upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // キャプション生成
  const { data: profile } = await admin
    .from("profiles")
    .select("desired_impression")
    .eq("id", user.id)
    .maybeSingle();

  const captionPrompt =
    `メンズ美容・第一印象の縦型ショート用キャプションを日本語で作る。\n` +
    `テロップ候補: ${title}\nハイライト理由: ${reason || "なし"}\n` +
    `自己紹介メモ: ${profile?.desired_impression ?? "なし"}\n` +
    `caption は本文80〜120字。hashtags は # を付けずに5個。platform_hint は最も合う投稿先。`;

  let caption = title;
  let hashtags: string[] = ["FirstLook", "メンズ美容", "清潔感"];
  let platform_hint = "reels";

  const ai = await generateAiObject(CaptionSchema, captionPrompt);
  if (ai) {
    caption = ai.value.caption;
    hashtags = ai.value.hashtags.map((h) => h.replace(/^#/, "")).filter(Boolean).slice(0, 8);
    platform_hint = ai.value.platform_hint;
  }

  const { data: clip, error: clipErr } = await admin
    .from("growth_clips")
    .insert({
      user_id: user.id,
      recording_id: recordingId,
      highlight_id: highlightId,
      storage_path: path,
      caption,
      hashtags,
      platform_hint,
      template_key: templateKey,
    })
    .select("id, storage_path, caption, hashtags, platform_hint, short_id, template_key, created_at")
    .single();

  if (clipErr) {
    if (/relation|does not exist|schema cache/i.test(clipErr.message)) {
      return NextResponse.json(
        { error: "growth_clips 未作成。0005_growth_phase1.sql を実行してください。" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: clipErr.message }, { status: 400 });
  }

  let shortId: string | null = null;
  if (publishShort) {
    if (!buckets?.some((b) => b.name === "shorts")) {
      await admin.storage.createBucket("shorts", { public: true });
    }
    const shortPath = `${user.id}/growth-${Date.now()}.${ext}`;
    const { error: sUp } = await admin.storage
      .from("shorts")
      .upload(shortPath, file, { contentType: file.type || "video/webm", upsert: false });
    if (!sUp) {
      const { data: shortRow } = await admin
        .from("shorts")
        .insert({
          user_id: user.id,
          video_path: shortPath,
          caption: `${caption}\n${hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`,
        })
        .select("id")
        .single();
      shortId = shortRow?.id ?? null;
      if (shortId) {
        await admin.from("growth_clips").update({ short_id: shortId }).eq("id", clip.id);
      }
    }
  }

  const { data: pub } = admin.storage.from("growth").getPublicUrl(path);
  await bumpUsage(admin, user.id, "clip_count");
  const limitsAfter = await getGrowthLimits(admin, user.id);
  return NextResponse.json({
    ok: true,
    clip: { ...clip, short_id: shortId, url: pub.publicUrl },
    caption,
    hashtags,
    platform_hint,
    ai: Boolean(ai),
    model: ai?.model ?? null,
    limits: limitsAfter,
  });
}
