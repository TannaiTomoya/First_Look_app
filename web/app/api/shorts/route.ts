import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_SIZE = 60 * 1024 * 1024; // 60MB

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = await createServiceClient();
  const { data, error } = await admin
    .from("shorts")
    .select("id, user_id, video_path, caption, created_at, profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    // shorts テーブル未作成（0003 未実行）の場合は空フィードを返す
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({ items: [], needsMigration: true });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: pub } = admin.storage.from("shorts").getPublicUrl("x");
  const base = pub.publicUrl.replace(/\/x$/, "");
  const items = (data ?? []).map((s) => ({
    id: s.id,
    caption: s.caption,
    created_at: s.created_at,
    url: `${base}/${s.video_path}`,
    mine: user?.id === s.user_id,
    author:
      (s.profiles as unknown as { display_name?: string } | null)?.display_name ?? "user",
  }));
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const caption = String(form.get("caption") ?? "");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "動画ファイルを選択してください" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "60MB以下の動画にしてください" }, { status: 400 });
  }
  const nameLower = file.name.toLowerCase();
  const isVideo =
    file.type.startsWith("video/") ||
    /\.(mov|mp4|m4v|webm|avi|mkv)$/.test(nameLower) ||
    file.type === "video/quicktime";
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) {
    return NextResponse.json({ error: "動画（mp4/mov等）または画像のみ投稿できます" }, { status: 400 });
  }

  const admin = await createServiceClient();
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === "shorts")) {
    await admin.storage.createBucket("shorts", { public: true });
  }

  let ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || ext.length > 5) {
    ext = isVideo ? (file.type.includes("webm") ? "webm" : "mp4") : "jpg";
  }
  // iPhone .mov / quicktime
  if (ext === "qt") ext = "mov";
  const contentType =
    file.type ||
    (ext === "mov" ? "video/quicktime" : isVideo ? `video/${ext}` : `image/${ext}`);
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("shorts")
    .upload(path, file, { contentType, upsert: false });
  if (upErr) return NextResponse.json({ error: `アップロード失敗: ${upErr.message}` }, { status: 400 });

  const { data: row, error: insErr } = await admin
    .from("shorts")
    .insert({
      user_id: user.id,
      video_path: path,
      caption,
    })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: `保存失敗: ${insErr.message}` }, { status: 400 });

  return NextResponse.json({ ok: true, id: row?.id });
}

/** キャプション編集 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const body = (await request.json()) as { id?: string; caption?: string };
  if (!body.id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });

  const admin = await createServiceClient();
  const { data: row } = await admin.from("shorts").select("user_id").eq("id", body.id).maybeSingle();
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "編集できない投稿です" }, { status: 403 });
  }

  const { error } = await admin
    .from("shorts")
    .update({ caption: body.caption ?? "" })
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
