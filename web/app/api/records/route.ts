import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const note = String(form.get("note") ?? "").slice(0, 500);
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "写真を選んでください" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "ファイルが大きすぎます（8MBまで）" }, { status: 400 });
  }

  const admin = await createServiceClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) {
    const base = (user.email ?? "user").split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "") || "user";
    const { error: pErr } = await admin.from("profiles").upsert(
      {
        id: user.id,
        display_name: base,
        username: `${base}-${user.id.slice(0, 8)}`,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (pErr) {
      // username 衝突時は username なしで再試行
      const retry = await admin.from("profiles").upsert(
        { id: user.id, display_name: base },
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (retry.error) {
        return NextResponse.json(
          { error: `プロフィール作成に失敗: ${retry.error.message}` },
          { status: 400 },
        );
      }
    }
    await admin.from("entitlements").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  }

  const ext =
    (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from("looks").upload(path, body, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (upErr) {
    const missing = /not found|does not exist|bucket/i.test(upErr.message);
    if (missing) {
      await admin.storage.createBucket("looks", { public: false });
      const retry = await admin.storage.from("looks").upload(path, body, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
      if (retry.error) {
        return NextResponse.json({ error: `画像保存に失敗: ${retry.error.message}` }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: `画像保存に失敗: ${upErr.message}` }, { status: 400 });
    }
  }

  const { count } = await admin
    .from("look_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: inserted, error: insErr } = await admin
    .from("look_records")
    .insert({
      user_id: user.id,
      photo_path: path,
      note,
      is_day0: (count ?? 0) === 0,
    })
    .select("id")
    .single();
  if (insErr) {
    return NextResponse.json({ error: `記録の保存に失敗: ${insErr.message}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}
