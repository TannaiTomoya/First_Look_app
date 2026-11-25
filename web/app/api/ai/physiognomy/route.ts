import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAiText, toLines } from "@/lib/ai";
import {
  PHYSIOGNOMY_BASELINE,
  PHYSIOGNOMY_THRESHOLDS,
  isValidRatios,
  type FaceRatios,
} from "@/lib/face-mesh/physiognomy";

export const dynamic = "force-dynamic";

// 出典（画面にも表示する）
const SOURCES = [
  "水野南北『南北相法』(1788) — 日本の観相学の古典",
  "Willis, J. & Todorov, A. (2006) “First Impressions: Making Up Your Mind After a 100-Ms Exposure to a Face”, Psychological Science 17(7)",
  "Todorov, A. (2017) “Face Value: The Irresistible Influence of First Impressions”, Princeton University Press",
];

function heuristicReading(r: FaceRatios) {
  const t = PHYSIOGNOMY_THRESHOLDS;
  const notes: string[] = [];
  if (r.faceAspect > t.longFace) notes.push("面長傾向: 落ち着き・誠実さが伝わりやすい（観相学の古典的解釈）。");
  else notes.push("丸顔〜標準傾向: 親しみやすさが第一印象で伝わりやすい。");
  if (r.eyeGap > t.wideEyes) notes.push("目の間隔が広め: おおらかな印象を与えやすい。");
  else if (r.eyeGap < t.narrowEyes) notes.push("目の間隔が狭め: 集中力・シャープな印象。");
  else notes.push("目の間隔は標準的: バランスの取れた印象。");
  if (r.jawWidth > t.strongJaw) notes.push("顎がしっかり: 意志の強さ・信頼感を演出しやすい。");
  return notes;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const r = (await request.json().catch(() => null)) as Partial<FaceRatios> | null;
  if (!isValidRatios(r)) {
    return NextResponse.json({ error: "顔の計測値が不正です。もう一度撮影してください。" }, { status: 400 });
  }
  const base = heuristicReading(r);
  const b = PHYSIOGNOMY_BASELINE;

  const ai = await generateAiText(
    `あなたは観相学（人相学）の解説者。以下の顔比率から、古典的な観相学での「印象の読み」を日本語で3行、断定を避けて解説。差別的・医学的断定は禁止。\n` +
      `比率は顔のランドマークから測った実測値。括弧内は標準的な顔モデルの値で、そこからの差だけを特徴として扱うこと。\n` +
      `顔縦横比:${r.faceAspect.toFixed(3)}（${b.faceAspect}） 目間隔/頬幅:${r.eyeGap.toFixed(3)}（${b.eyeGap}） 顎幅/頬幅:${r.jawWidth.toFixed(3)}（${b.jawWidth}）\n` +
      `額の広さは測れていないので触れないこと。`,
  );

  return NextResponse.json({
    reading: ai ? toLines(ai.value, 4) : base,
    sources: SOURCES,
    disclaimer:
      "人相学（観相学）は伝統的な解釈体系であり、科学的に性格や能力を判定できるものではありません。第一印象研究（Todorov ほか）は「人がどう見られやすいか」の傾向を示すもので、本人の実際の性質を示すものではありません。エンタメ・自己演出のヒントとしてご利用ください。",
    ai: Boolean(ai),
    model: ai?.model ?? null,
    source: ai ? "gemini" : "heuristic",
  });
}
