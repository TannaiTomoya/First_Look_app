import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** ジョブ状態更新（クライアントWorkerが実行中/完了を報告） */
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const body = (await request.json()) as {
    status?: "running" | "done" | "failed";
    result?: Record<string, unknown>;
    error?: string;
  };

  const admin = await createServiceClient();
  const { data: job } = await admin
    .from("growth_jobs")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "ジョブが見つかりません" }, { status: 404 });
  }

  const { error } = await admin
    .from("growth_jobs")
    .update({
      status: body.status ?? "running",
      result: body.result ?? {},
      error: body.error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const admin = await createServiceClient();
  const { data: job, error } = await admin
    .from("growth_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }
  return NextResponse.json({ job });
}
