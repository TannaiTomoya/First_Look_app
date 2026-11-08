import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { summarizeMetrics, type MetricRow } from "@/lib/growth/metrics";

export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function isMissingTable(msg: string) {
  return /relation|does not exist|schema cache/i.test(msg);
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const wantSummary = searchParams.get("summary") === "1";

  const admin = await createServiceClient();
  const { data, error } = await admin
    .from("growth_metrics")
    .select("id, platform, posted_at, views, likes, saves, comments, follows_delta, note, title, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingTable(error.message)) {
      return NextResponse.json({
        items: [],
        summary: summarizeMetrics([]),
        needsMigration: true,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const items = (data ?? []) as MetricRow[];
  if (wantSummary) {
    return NextResponse.json({ items, summary: summarizeMetrics(items) });
  }
  return NextResponse.json({ items, summary: summarizeMetrics(items) });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const body = (await request.json()) as Partial<MetricRow> & { platform?: string };
  const platform = (body.platform ?? "").trim().toLowerCase();
  if (!platform) return NextResponse.json({ error: "プラットフォームを選んでください" }, { status: 400 });

  const row = {
    user_id: user.id,
    platform,
    posted_at: body.posted_at || null,
    views: Math.max(0, Number(body.views) || 0),
    likes: Math.max(0, Number(body.likes) || 0),
    saves: Math.max(0, Number(body.saves) || 0),
    comments: Math.max(0, Number(body.comments) || 0),
    follows_delta: Number(body.follows_delta) || 0,
    note: body.note?.slice(0, 500) || null,
    title: body.title?.slice(0, 120) || null,
  };

  const admin = await createServiceClient();
  // profiles 保証
  const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) {
    const base = (user.email ?? "user").split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "") || "user";
    await admin.from("profiles").upsert(
      { id: user.id, display_name: base, username: `${base}-${user.id.slice(0, 8)}` },
      { onConflict: "id", ignoreDuplicates: true },
    );
  }

  const { data, error } = await admin.from("growth_metrics").insert(row).select("id").single();
  if (error) {
    if (isMissingTable(error.message)) {
      return NextResponse.json(
        { error: "growth_metrics 未作成です。0004_growth.sql を実行してください。" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: data?.id });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });

  const admin = await createServiceClient();
  const { error } = await admin.from("growth_metrics").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
