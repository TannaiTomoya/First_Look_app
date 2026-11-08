import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertRecordingDuration, getGrowthLimits } from "@/lib/growth/limits";

export const dynamic = "force-dynamic";

const MAX_SIZE = 200 * 1024 * 1024; // 200MB

function missing(msg: string) {
  return /relation|does not exist|schema cache/i.test(msg);
}

async function ensureProfile(
  admin: Awaited<ReturnType<typeof createServiceClient>>,
  user: { id: string; email?: string | null },
) {
  const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (profile) return;
  const base = (user.email ?? "user").split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "") || "user";
  await admin.from("profiles").upsert(
    { id: user.id, display_name: base, username: `${base}-${user.id.slice(0, 8)}` },
    { onConflict: "id", ignoreDuplicates: true },
  );
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const admin = await createServiceClient();
  const { data, error } = await admin
    .from("growth_recordings")
    .select("id, title, source, storage_path, duration_sec, status, public_url, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    if (missing(error.message)) return NextResponse.json({ items: [], needsMigration: true });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").slice(0, 120) || "無題の録画";
  const source = String(form.get("source") ?? "other").slice(0, 40);
  const durationSec = Number(form.get("duration_sec")) || null;
  const highlightsRaw = String(form.get("highlights") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "動画ファイルを選択してください" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "200MB以下にしてください" }, { status: 400 });
  }
  const nameLower = file.name.toLowerCase();
  const isVideo =
    file.type.startsWith("video/") ||
    /\.(mov|mp4|m4v|webm)$/.test(nameLower) ||
    file.type === "video/quicktime";
  if (!isVideo) {
    return NextResponse.json({ error: "動画（mp4/mov等）のみアップロードできます" }, { status: 400 });
  }

  const admin = await createServiceClient();
  await ensureProfile(admin, user);

  if (durationSec) {
    const limits = await getGrowthLimits(admin, user.id);
    const durErr = assertRecordingDuration(limits, durationSec);
    if (durErr) return NextResponse.json({ error: durErr, limits }, { status: 402 });
  }

  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === "growth")) {
    await admin.storage.createBucket("growth", { public: true });
  }

  let ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  if (ext === "qt") ext = "mov";
  if (ext.length > 5) ext = "mp4";
  const contentType =
    file.type || (ext === "mov" ? "video/quicktime" : `video/${ext === "mp4" ? "mp4" : ext}`);
  const path = `${user.id}/rec-${Date.now()}.${ext}`;

  const { error: upErr } = await admin.storage
    .from("growth")
    .upload(path, file, { contentType, upsert: false });
  if (upErr) return NextResponse.json({ error: `アップロード失敗: ${upErr.message}` }, { status: 400 });

  const { data: pub } = admin.storage.from("growth").getPublicUrl(path);

  const { data: rec, error: insErr } = await admin
    .from("growth_recordings")
    .insert({
      user_id: user.id,
      title,
      source,
      storage_path: path,
      duration_sec: durationSec,
      status: "ready",
      public_url: pub.publicUrl,
    })
    .select("id, title, source, storage_path, duration_sec, status, public_url, created_at")
    .single();

  if (insErr) {
    if (missing(insErr.message)) {
      return NextResponse.json(
        { error: "テーブル未作成です。0004 と 0005 の SQL を実行してください。" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  // ハイライト候補を同時保存（クライアント解析結果）
  let highlights: unknown[] = [];
  if (highlightsRaw) {
    try {
      const parsed = JSON.parse(highlightsRaw) as Array<{
        start_sec: number;
        end_sec: number;
        score?: number;
        reason?: string;
        selected?: boolean;
      }>;
      if (Array.isArray(parsed) && parsed.length) {
        const rows = parsed.slice(0, 8).map((h, i) => ({
          recording_id: rec.id,
          user_id: user.id,
          start_sec: h.start_sec,
          end_sec: h.end_sec,
          score: h.score ?? 0.5,
          reason: h.reason ?? "候補",
          selected: Boolean(h.selected) || i < 3,
        }));
        const { data: hs, error: hErr } = await admin.from("growth_highlights").insert(rows).select("*");
        if (!hErr) highlights = hs ?? [];
      }
    } catch {
      // ハイライト無しでも録画は成功
    }
  }

  return NextResponse.json({ ok: true, recording: rec, highlights });
}
