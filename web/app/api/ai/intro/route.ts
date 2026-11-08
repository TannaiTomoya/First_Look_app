import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askGemini } from "@/lib/ai";

export const dynamic = "force-dynamic";

type IntroInput = {
  name: string;
  age?: string;
  job?: string;
  hobby?: string;
  strength?: string;
  goal: "婚活" | "商談" | "面接" | "SNS";
  tone: "誠実" | "明るい" | "落ち着き";
};

function template(i: IntroInput) {
  const hobby = i.hobby ? `休日は${i.hobby}を楽しんでいます。` : "";
  const strength = i.strength ? `周りからは「${i.strength}」と言われることが多いです。` : "";
  const job = i.job ? `${i.job}をしています。` : "";
  const age = i.age ? `${i.age}歳、` : "";
  if (i.goal === "婚活") {
    return `はじめまして、${i.name}です。${age}${job}${hobby}${strength}会って話すと印象が変わるタイプだと思うので、まずは気軽にお話しできたら嬉しいです。よろしくお願いします。`;
  }
  if (i.goal === "面接") {
    return `${i.name}と申します。${job}${strength}日々の記録と改善を継続する習慣があり、御社でも同じ姿勢で成果に貢献したいと考えています。本日はよろしくお願いいたします。`;
  }
  if (i.goal === "商談") {
    return `${i.name}と申します。${job}お客様の課題を「見える化→小さく改善」する進め方を得意としています。${strength}本日は限られた時間で要点からお話しします。`;
  }
  return `${i.name} | ${i.job ?? ""} ${hobby} ${strength} 毎日1枚、変化を記録中。#FirstLook`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const input = (await request.json()) as IntroInput;
  if (!input.name) return NextResponse.json({ error: "名前を入れてください" }, { status: 400 });

  const fallback = template(input);
  const ai = await askGemini(
    `${input.goal}向けの自己紹介文を1つ、日本語で120〜200字。トーンは「${input.tone}」。誇張せず、具体的に。\n` +
      `名前:${input.name} 年齢:${input.age ?? "非公開"} 職業:${input.job ?? "非公開"} 趣味:${input.hobby ?? "なし"} 強み:${input.strength ?? "なし"}\n本文のみ出力。`,
  );

  return NextResponse.json({ text: ai?.trim() || fallback, source: ai ? "gemini" : "template" });
}
