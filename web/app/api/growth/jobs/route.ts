import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertClipAllowed, assertTemplateAllowed, getGrowthLimits } from "@/lib/growth/limits";

export const dynamic = "force-dynamic";

function missing(msg: string) {
  return /relation|does not exist|schema cache/i.test(msg);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const admin = await createServiceClient();
  const { data, error } = await admin
    .from("growth_jobs")
    .select("id, kind, status, payload, result, error, recording_id, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    if (missing(error.message)) return NextResponse.json({ items: [], needsMigration: true });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ items: data ?? [] });
}

/** クリップ生成ジョブをキューへ */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const body = (await request.json()) as {
    recording_id?: string;
    highlight_ids?: string[];
    template_key?: string;
    title?: string;
  };
  if (!body.recording_id || !body.highlight_ids?.length) {
    return NextResponse.json({ error: "recording_id と highlight_ids が必要です" }, { status: 400 });
  }

  const admin = await createServiceClient();
  const limits = await getGrowthLimits(admin, user.id);
  const clipErr = assertClipAllowed(limits);
  if (clipErr) return NextResponse.json({ error: clipErr, limits }, { status: 402 });
  const tplErr = assertTemplateAllowed(limits, body.template_key ?? "standard_15");
  if (tplErr) return NextResponse.json({ error: tplErr, upgrade: "premium_annual" }, { status: 403 });

  // 残枠以上の一括は不可
  const remaining = limits.clipLimit - limits.clipUsed;
  const ids = body.highlight_ids.slice(0, Math.max(0, remaining));
  if (!ids.length) {
    return NextResponse.json({ error: "クリップ残枠がありません", limits }, { status: 402 });
  }

  const { data: job, error } = await admin
    .from("growth_jobs")
    .insert({
      user_id: user.id,
      recording_id: body.recording_id,
      kind: "clip",
      status: "queued",
      payload: {
        highlight_ids: ids,
        template_key: body.template_key ?? "standard_15",
        title: body.title ?? "FIRSTLOOK",
      },
    })
    .select("id, status, payload")
    .single();

  if (error) {
    if (missing(error.message)) {
      return NextResponse.json(
        { error: "growth_jobs 未作成。0006_growth_phase2.sql を実行してください。" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, job, limits });
}
