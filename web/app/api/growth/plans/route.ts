import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { askGemini } from "@/lib/ai";
import { summarizeMetrics, type MetricRow } from "@/lib/growth/metrics";
import { assertUnlimitedPlans, getGrowthLimits } from "@/lib/growth/limits";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const admin = await createServiceClient();
  const { data, error } = await admin
    .from("growth_plans")
    .select("id, title, body, posts, source, consultation_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({ items: [], needsMigration: true });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ items: data ?? [] });
}

/** 丹内相談後などの「発信プラン」を自動下書き */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const body = (await request.json()) as {
    consultation_id?: string;
    topic?: string;
  };

  const admin = await createServiceClient();
  const limits = await getGrowthLimits(admin, user.id);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("growth_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", monthStart.toISOString());
  const planErr = assertUnlimitedPlans(limits, count ?? 0);
  if (planErr) {
    return NextResponse.json({ error: planErr, upgrade: "premium_annual" }, { status: 403 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("desired_impression, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: metrics } = await admin
    .from("growth_metrics")
    .select("platform, title, views, likes, saves, comments, follows_delta, note")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const summary = summarizeMetrics((metrics ?? []) as MetricRow[]);
  const topic = body.topic || "第一印象・婚活の発信";

  const prompt =
    `あなたはメンズ美容SNSの編集者。丹内智弥の個別相談後に実行する「2週間の発信プラン」を作る。\n` +
    `トピック:${topic}\n自己紹介:${profile?.desired_impression ?? "未設定"}\n` +
    `KPI: 投稿${summary.count} 再生${summary.views} 保存率${(summary.saveRate * 100).toFixed(1)}%\n` +
    `直近ログ:${JSON.stringify(metrics ?? [])}\n` +
    `出力はJSONのみ: {"title":"プラン名","body":"方針200字以内","posts":[{"day":1,"platform":"reels|shorts|tiktok","hook":"冒頭1秒","caption":"本文","cta":"行動"}]}` +
    `\npostsはちょうど6本。医療・差別禁止。`;

  const ai = await askGemini(prompt);
  let title = `${profile?.display_name ?? "あなた"}の発信プラン`;
  let planBody =
    "清潔感のビフォー→1アクション→結果の型で、週3本の縦型を出す。数字を見て翌週の型を1つだけ変える。";
  let posts: unknown[] = [
    { day: 1, platform: "reels", hook: "眉下1列だけ", caption: "今日の1分ケア", cta: "保存して今夜やる" },
    { day: 3, platform: "shorts", hook: "商談前の3秒", caption: "姿勢と口角", cta: "コメントで相談" },
    { day: 5, platform: "reels", hook: "肌テカリ対策", caption: "あぶらとり→保湿", cta: "フォローで続き" },
    { day: 8, platform: "tiktok", hook: "自己紹介15秒", caption: "婚活向け", cta: "プロフィールへ" },
    { day: 10, platform: "reels", hook: "Before/After", caption: "2週間の変化", cta: "保存" },
    { day: 14, platform: "shorts", hook: "次の実験", caption: "数字で振り返り", cta: "成長スタジオへ" },
  ];

  if (ai) {
    try {
      const m = ai.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]) as {
          title?: string;
          body?: string;
          posts?: unknown[];
        };
        if (parsed.title) title = parsed.title;
        if (parsed.body) planBody = parsed.body;
        if (parsed.posts?.length) posts = parsed.posts.slice(0, 8);
      }
    } catch {
      planBody = ai.slice(0, 400);
    }
  }

  const { data: plan, error } = await admin
    .from("growth_plans")
    .insert({
      user_id: user.id,
      consultation_id: body.consultation_id || null,
      title,
      body: planBody,
      posts,
      source: body.consultation_id ? "consult" : "growth",
    })
    .select("id, title, body, posts, source, created_at")
    .single();

  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json(
        { error: "growth_plans 未作成。0006_growth_phase2.sql を実行してください。" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, plan, source: ai ? "gemini" : "template" });
}
