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

  const body = (await request.json()) as { scheduledAt?: string; coachId?: string; topic?: string };
  const scheduledAt = body.scheduledAt;
  if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) {
    return NextResponse.json({ error: "日時を選んでください" }, { status: 400 });
  }

  const when = new Date(scheduledAt);
  if (when.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: "過去の日時は選べません" }, { status: 400 });
  }

  const admin = await createServiceClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) {
    const base = (user.email ?? "user").split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "") || "user";
    await admin.from("profiles").upsert(
      { id: user.id, display_name: base, username: `${base}-${user.id.slice(0, 8)}` },
      { onConflict: "id", ignoreDuplicates: true },
    );
  }

  const topic = body.topic === "婚活相談" ? "婚活相談" : "第一印象相談";
  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    coach_id: body.coachId || null,
    scheduled_at: when.toISOString(),
    status: "pending",
  };

  let { data, error } = await admin
    .from("consultations")
    .insert({ ...insertPayload, topic })
    .select("id, scheduled_at, status")
    .single();

  // topic 列がまだ無い環境（0003 未実行）でも予約自体は通す
  if (error && /topic/.test(error.message)) {
    const retry = await admin
      .from("consultations")
      .insert(insertPayload)
      .select("id, scheduled_at, status")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, booking: data });
}
