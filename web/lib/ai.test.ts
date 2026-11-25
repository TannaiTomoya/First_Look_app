import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { z } from "zod";
import { DEFAULT_TEXT_MODEL, generateAiObject, generateAiText, toLines } from "./ai.ts";

type Call = { url: string; headers: Headers; body: unknown };
const realFetch = globalThis.fetch;
let calls: Call[] = [];

function mockGemini(text: string, status = 200) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    const payload =
      status === 200
        ? {
            candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }],
            usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 10 },
          }
        : { error: { code: status, message: "model not found", status: "NOT_FOUND" } };
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.AI_TEXT_MODEL;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("既定モデルを呼び、API キーは URL ではなくヘッダで送る", async () => {
  mockGemini("  こんにちは  ");
  const res = await generateAiText("hi");
  assert.deepEqual(res, { value: "こんにちは", model: DEFAULT_TEXT_MODEL });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, new RegExp(`/models/${DEFAULT_TEXT_MODEL}:generateContent`));
  assert.doesNotMatch(calls[0].url, /key=/);
  assert.equal(calls[0].headers.get("x-goog-api-key"), "test-key");
});

test("AI_TEXT_MODEL で差し替えられる", async () => {
  process.env.AI_TEXT_MODEL = "gemini-other-flash";
  mockGemini("ok");
  const res = await generateAiText("hi");
  assert.equal(res?.model, "gemini-other-flash");
  assert.match(calls[0].url, /\/models\/gemini-other-flash:generateContent/);
});

test("提供終了などの API エラーは null（握りつぶさず呼び出し側で簡易版にする）", async () => {
  mockGemini("", 404);
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    assert.equal(await generateAiText("hi"), null);
  } finally {
    console.error = original;
  }
  assert.equal(errors.length, 1, "失敗はログに残す");
});

test("API キー未設定なら通信せず null", async () => {
  delete process.env.GEMINI_API_KEY;
  mockGemini("unused");
  assert.equal(await generateAiText("hi"), null);
  assert.equal(calls.length, 0);
});

test("構造化出力はスキーマで検証される", async () => {
  const schema = z.object({ caption: z.string(), hashtags: z.array(z.string()) });
  mockGemini(JSON.stringify({ caption: "清潔感は眉から", hashtags: ["メンズ美容"] }));
  const ok = await generateAiObject(schema, "x");
  assert.deepEqual(ok?.value, { caption: "清潔感は眉から", hashtags: ["メンズ美容"] });
  assert.ok((calls[0].body as { generationConfig?: { responseSchema?: unknown } }).generationConfig);

  mockGemini(JSON.stringify({ caption: 123 }));
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal(await generateAiObject(schema, "x"), null, "スキーマ違反は null");
  } finally {
    console.error = original;
  }
});

test("toLines は箇条書き記号と番号を除く", () => {
  assert.deepEqual(toLines("- a\n・b\n2. c\n\n* d\n e", 4), ["a", "b", "c", "d"]);
});
