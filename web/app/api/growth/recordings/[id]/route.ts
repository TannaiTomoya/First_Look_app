import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const admin = await createServiceClient();
  const { data: rec, error } = await admin
    .from("growth_recordings")
    .select("id, title, source, storage_path, duration_sec, status, public_url, created_at, user_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!rec || rec.user_id !== user.id) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  const { data: highlights } = await admin
    .from("growth_highlights")
    .select("id, start_sec, end_sec, score, reason, selected, created_at")
    .eq("recording_id", id)
    .order("start_sec", { ascending: true });

  const { data: clips } = await admin
    .from("growth_clips")
    .select("id, storage_path, caption, hashtags, platform_hint, short_id, highlight_id, created_at")
    .eq("recording_id", id)
    .order("created_at", { ascending: false });

  const { data: pubBase } = admin.storage.from("growth").getPublicUrl("x");
  const base = pubBase.publicUrl.replace(/\/x$/, "");

  return NextResponse.json({
    recording: {
      ...rec,
      url: rec.public_url || `${base}/${rec.storage_path}`,
    },
    highlights: highlights ?? [],
    clips: (clips ?? []).map((c) => ({
      ...c,
      url: `${base}/${c.storage_path}`,
    })),
  });
}
