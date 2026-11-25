import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import type { z } from "zod";

/**
 * AI 呼び出しの共通窓口。
 *
 * - モデルは環境変数 AI_TEXT_MODEL で差し替える（提供終了時にコード変更不要）
 * - 失敗は握りつぶさずログに残し、呼び出し側には `null` を返す。
 *   呼び出し側はレスポンスに `ai: false` を付けて、画面で「簡易版」と分かるようにする。
 */

/** 2026-09 GA。提供終了時は AI_TEXT_MODEL で上書きする */
export const DEFAULT_TEXT_MODEL = "gemini-3.8-flash";

const TIMEOUT_MS = 20_000;

export function aiTextModelId(): string {
  return process.env.AI_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL;
}

export const isAiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

function model() {
  // API キーはヘッダ（x-goog-api-key）で送られる。URL には載らない
  const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
  return google(aiTextModelId());
}

export type AiResult<T> = { value: T; model: string };

function logFailure(kind: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[ai] ${kind} failed (model=${aiTextModelId()}): ${message}`);
}

/** 自由文の生成。失敗・未設定なら null */
export async function generateAiText(
  prompt: string,
  opts?: { temperature?: number; maxOutputTokens?: number },
): Promise<AiResult<string> | null> {
  if (!isAiConfigured()) return null;
  try {
    const { text } = await generateText({
      model: model(),
      prompt,
      temperature: opts?.temperature ?? 0.6,
      maxOutputTokens: opts?.maxOutputTokens ?? 1024,
      timeout: TIMEOUT_MS,
    });
    const trimmed = text.trim();
    if (!trimmed) {
      logFailure("text", new Error("empty response"));
      return null;
    }
    return { value: trimmed, model: aiTextModelId() };
  } catch (err) {
    logFailure("text", err);
    return null;
  }
}

/** スキーマどおりの JSON を生成。失敗・未設定・検証エラーなら null */
export async function generateAiObject<S extends z.ZodType>(
  schema: S,
  prompt: string,
  opts?: { temperature?: number; maxOutputTokens?: number },
): Promise<AiResult<z.infer<S>> | null> {
  if (!isAiConfigured()) return null;
  try {
    const { output } = await generateText({
      model: model(),
      prompt,
      output: Output.object({ schema }),
      temperature: opts?.temperature ?? 0.6,
      maxOutputTokens: opts?.maxOutputTokens ?? 2048,
      timeout: TIMEOUT_MS,
    });
    return { value: output as z.infer<S>, model: aiTextModelId() };
  } catch (err) {
    logFailure("object", err);
    return null;
  }
}

/** 箇条書きの AI 出力を行配列にする */
export function toLines(text: string, max = 4): string[] {
  return text
    .split("\n")
    .map((s) => s.replace(/^\s*(?:[-*・•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

/** 疎通確認（/api/health?deep=1 用）。結果は isolate 内で 10 分キャッシュ */
let lastPing: { at: number; ok: boolean; model: string; error?: string } | null = null;

export async function pingAi(): Promise<{ ok: boolean; model: string; configured: boolean; error?: string }> {
  const modelId = aiTextModelId();
  if (!isAiConfigured()) return { ok: false, model: modelId, configured: false, error: "GEMINI_API_KEY 未設定" };
  if (lastPing && lastPing.model === modelId && Date.now() - lastPing.at < 10 * 60_000) {
    return { ok: lastPing.ok, model: modelId, configured: true, error: lastPing.error };
  }
  try {
    await generateText({ model: model(), prompt: "OK とだけ返して", maxOutputTokens: 8, timeout: 10_000 });
    lastPing = { at: Date.now(), ok: true, model: modelId };
  } catch (err) {
    lastPing = {
      at: Date.now(),
      ok: false,
      model: modelId,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    };
  }
  return { ok: lastPing.ok, model: modelId, configured: true, error: lastPing.error };
}
