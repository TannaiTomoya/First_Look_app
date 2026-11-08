import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 自己紹介文を profiles.desired_impression に保存 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const body = (await request.json()) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "保存する文章がありません" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "文字数が多すぎます" }, { status: 400 });

  const admin = await createServiceClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) {
    const base = (user.email ?? "user").split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "") || "user";
    await admin.from("profiles").upsert(
      { id: user.id, display_name: base, username: `${base}-${user.id.slice(0, 8)}` },
      { onConflict: "id", ignoreDuplicates: true },
    );
  }

  const { error } = await admin
    .from("profiles")
    .update({ desired_impression: text, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const admin = await createServiceClient();
  const { data } = await admin
    .from("profiles")
    .select("desired_impression")
    .eq("id", user.id)
    .maybeSingle();
  return NextResponse.json({ text: data?.desired_impression ?? null });
}
