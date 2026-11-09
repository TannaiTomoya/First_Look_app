import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { askGemini } from "@/lib/ai";
import { summarizeMetrics, type MetricRow } from "@/lib/growth/metrics";
import { buildCoachSystemContext, heuristicCoachReply } from "@/lib/growth/prompts";
import { assertCoachAllowed, bumpUsage, getGrowthLimits } from "@/lib/growth/limits";

export const dynamic = "force-dynamic";

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const body = (await request.json()) as {
    message?: string;
    history?: Turn[];
    end?: boolean;
  };
  const message = (body.message ?? "").trim();
  if (!message && !body.end) {
    return NextResponse.json({ error: "メッセージを入力してください" }, { status: 400 });
  }

  const admin = await createServiceClient();
  const limits = await getGrowthLimits(admin, user.id);
  // 会話の「送信」時のみ枠を消費（終了要約は消費しない）
  if (!body.end) {
    const blocked = assertCoachAllowed(limits);
    if (blocked) return NextResponse.json({ error: blocked, limits }, { status: 402 });
  }
  let metrics: MetricRow[] = [];
  const { data: mdata, error: mErr } = await admin
    .from("growth_metrics")
    .select("id, platform, posted_at, views, likes, saves, comments, follows_delta, note, title, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!mErr && mdata) metrics = mdata as MetricRow[];
  const summary = summarizeMetrics(metrics);

  const { data: profile } = await admin
    .from("profiles")
    .select("desired_impression")
    .eq("id", user.id)
    .maybeSingle();

  const context = buildCoachSystemContext(summary, metrics, profile?.desired_impression);

  if (body.end) {
    const historyText = (body.history ?? [])
      .map((t) => `${t.role === "user" ? "ユーザー" : "コーチ"}: ${t.content}`)
      .join("\n");
    const endPrompt =
      `${context}\n\n【会話ログ】\n${historyText || "(なし)"}\n\n` +
      `この会話を踏まえ、「今週やる具体アクション」を日本語で3つだけ箇条書き。各行20〜40字。`;
    const ai = await askGemini(endPrompt);
    const summaryText =
      ai?.trim() ||
      [
        "・直近投稿の保存率を記録する",
        "・結論テロップ付き15秒を1本出す",
        "・反応を見て型を1つ決める",
      ].join("\n");

    const transcript = [
      historyText,
      message ? `ユーザー: ${message}` : "",
      `コーチ(要約): ${summaryText}`,
    ]
      .filter(Boolean)
      .join("\n");

    const { data: session, error } = await admin
      .from("growth_coach_sessions")
      .insert({
        user_id: user.id,
        transcript,
        summary: summaryText,
        metrics_snapshot: summary,
      })
      .select("id")
      .single();

    if (error && !/relation|does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      ended: true,
      reply: summaryText,
      sessionId: session?.id ?? null,
      source: ai ? "gemini" : "heuristic",
    });
  }

  const history = (body.history ?? []).slice(-8);
  const historyBlock = history.map((t) => `${t.role}: ${t.content}`).join("\n");
  const prompt =
    `${context}\n\n【これまでの会話】\n${historyBlock || "(なし)"}\n\n` +
    `user: ${message}\nassistant:` +
    `\n（120〜220字。観察→仮説→次の実験の順。箇条書き可）`;

  const ai = await askGemini(prompt);
  const reply = ai?.trim() || heuristicCoachReply(message, summary);

  await bumpUsage(admin, user.id, "coach_count");
  let limitsAfter = limits;
  try {
    limitsAfter = await getGrowthLimits(admin, user.id);
  } catch {
    // usage テーブル未作成時は無視
  }

  return NextResponse.json({
    reply,
    source: ai ? "gemini" : "heuristic",
    summary,
    limits: limitsAfter,
  });
}
