import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askGemini } from "@/lib/ai";

export const dynamic = "force-dynamic";

// 出典（画面にも表示する）
const SOURCES = [
  "水野南北『南北相法』(1788) — 日本の観相学の古典",
  "Willis, J. & Todorov, A. (2006) “First Impressions: Making Up Your Mind After a 100-Ms Exposure to a Face”, Psychological Science 17(7)",
  "Todorov, A. (2017) “Face Value: The Irresistible Influence of First Impressions”, Princeton University Press",
];

type FaceRatios = {
  faceAspect: number; // 縦/横
  eyeGap: number; // 目間隔/顔幅
  jawWidth: number; // 顎幅/顔幅
  foreheadRatio: number; // 額の高さ/顔の高さ
};

function heuristicReading(r: FaceRatios) {
  const notes: string[] = [];
  if (r.faceAspect > 1.35) notes.push("面長傾向: 落ち着き・誠実さが伝わりやすい（観相学の古典的解釈）。");
  else notes.push("丸顔〜標準傾向: 親しみやすさが第一印象で伝わりやすい。");
  if (r.eyeGap > 0.46) notes.push("目の間隔が広め: おおらかな印象を与えやすい。");
  else notes.push("目の間隔が標準〜狭め: 集中力・シャープな印象。");
  if (r.jawWidth > 0.78) notes.push("顎がしっかり: 意志の強さ・信頼感を演出しやすい。");
  if (r.foreheadRatio > 0.36) notes.push("額が広め: 知的な印象が出やすい。前髪で調整可能。");
  return notes;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const r = (await request.json()) as FaceRatios;
  const base = heuristicReading(r);

  const ai = await askGemini(
    `あなたは観相学（人相学）の解説者。以下の顔比率から、古典的な観相学での「印象の読み」を日本語で3行、断定を避けて解説。差別的・医学的断定は禁止。\n` +
      `顔縦横比:${r.faceAspect.toFixed(2)} 目間隔比:${r.eyeGap.toFixed(2)} 顎幅比:${r.jawWidth.toFixed(2)} 額比:${r.foreheadRatio.toFixed(2)}`,
  );

  return NextResponse.json({
    reading: ai
      ? ai.split("\n").map((s) => s.replace(/^[-*・]\s*/, "").trim()).filter(Boolean).slice(0, 4)
      : base,
    sources: SOURCES,
    disclaimer:
      "人相学（観相学）は伝統的な解釈体系であり、科学的に性格や能力を判定できるものではありません。第一印象研究（Todorov ほか）は「人がどう見られやすいか」の傾向を示すもので、本人の実際の性質を示すものではありません。エンタメ・自己演出のヒントとしてご利用ください。",
    source: ai ? "gemini" : "heuristic",
  });
}
