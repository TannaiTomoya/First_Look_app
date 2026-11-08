import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askGemini } from "@/lib/ai";

export const dynamic = "force-dynamic";

type Metrics = {
  brightness: number; // 0-255
  contrast: number; // 標準偏差
  redness: number; // R-(G+B)/2 平均
  shineRatio: number; // 高輝度ピクセル比率 0-1
  answers?: Record<string, string>;
};

function heuristicFeedback(m: Metrics) {
  const tips: string[] = [];
  if (m.shineRatio > 0.12) tips.push("Tゾーンのテカリが強め。あぶらとり紙→軽い保湿の順で整える。");
  else if (m.brightness < 90) tips.push("肌のトーンが暗め。睡眠と洗顔後の保湿を3日続けて再撮影を。");
  else tips.push("皮脂バランスは安定。現状のケアを維持。");
  if (m.redness > 18) tips.push("赤みが出ています。熱いお湯での洗顔・こすり洗いを避ける。");
  if (m.contrast > 55) tips.push("影・凹凸が目立つ照明です。正面からの均一な光で撮ると比較精度が上がる。");
  tips.push("今日の1つ: 洗顔→保湿→眉の余分な1本だけ抜く。1分で終了。");
  return {
    score: Math.max(40, Math.min(95, Math.round(100 - m.shineRatio * 200 - Math.max(0, m.redness - 10)))),
    summary: tips[0],
    tips,
    source: "heuristic" as const,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const m = (await request.json()) as Metrics;
  const base = heuristicFeedback(m);

  const ai = await askGemini(
    `あなたはメンズ美容の専門アドバイザー。以下の肌指標から、清潔感を上げる具体的な行動を3つ、日本語で簡潔に。医療診断はしない。\n` +
      `明るさ:${m.brightness}/255 コントラスト:${m.contrast} 赤み:${m.redness} テカリ率:${(m.shineRatio * 100).toFixed(1)}%\n` +
      `セルフ回答:${JSON.stringify(m.answers ?? {})}\n出力: 箇条書き3行のみ。`,
  );

  if (ai) {
    return NextResponse.json({
      ...base,
      tips: ai.split("\n").map((s) => s.replace(/^[-*・]\s*/, "").trim()).filter(Boolean).slice(0, 4),
      source: "gemini",
    });
  }
  return NextResponse.json(base);
}
