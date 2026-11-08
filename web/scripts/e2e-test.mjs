// 本番APIの動作確認用スクリプト。
// テストユーザーを作成し、認証Cookieを組み立てて各APIを叩く。
// 秘密情報は一切出力しない（ステータスとエラーメッセージのみ）。
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://firstlook.tomobou5912.workers.dev";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.log("env 不足のため中止");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];

const admin = createClient(url, service, { auth: { persistSession: false } });
const email = `e2e-${Date.now()}@example.com`;
const password = `Test-${Math.random().toString(36).slice(2)}!9`;

const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
console.log("createUser:", cErr ? `NG ${cErr.message}` : "OK");
if (cErr) process.exit(1);

const anonClient = createClient(url, anon, { auth: { persistSession: false } });
const { data: signin, error: sErr } = await anonClient.auth.signInWithPassword({ email, password });
console.log("signIn:", sErr ? `NG ${sErr.message}` : "OK");
if (sErr) process.exit(1);

// @supabase/ssr のCookie形式: sb-<ref>-auth-token = base64-<base64url(JSON session)>
const sessionJson = JSON.stringify(signin.session);
const b64 = Buffer.from(sessionJson, "utf8").toString("base64url");
const cookie = `sb-${ref}-auth-token=base64-${b64}`;

async function call(name, path, init) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { cookie, ...(init?.headers ?? {}) },
    });
    let msg = "";
    try {
      const j = await res.clone().json();
      msg = j.error ?? j.url ?? (j.ok ? "ok" : JSON.stringify(j).slice(0, 120));
    } catch {
      msg = "(non-json)";
    }
    console.log(`${name}: ${res.status} ${msg}`);
    return res.status;
  } catch (e) {
    console.log(`${name}: EXC ${e.message}`);
    return 0;
  }
}

// 1px JPEG
const jpegBase64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
const jpegBuf = Buffer.from(jpegBase64, "base64");

// 記録保存（プロフィール自動作成込み）
const fd = new FormData();
fd.append("file", new File([jpegBuf], "test.jpg", { type: "image/jpeg" }));
fd.append("note", "e2e");
await call("records POST", "/api/records", { method: "POST", body: fd });

// AI 肌フィードバック
await call("ai/skin POST", "/api/ai/skin", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ brightness: 140, contrast: 40, redness: 12, shineRatio: 0.08, answers: { tzone: "少しベタつく" } }),
});

// 人相AI
await call("ai/physiognomy POST", "/api/ai/physiognomy", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ faceAspect: 1.3, eyeGap: 0.45, jawWidth: 0.8, foreheadRatio: 0.35 }),
});

// 自己紹介
await call("ai/intro POST", "/api/ai/intro", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "テスト", age: "28", job: "会社員", hobby: "サウナ", strength: "聞き上手", goal: "婚活", tone: "誠実" }),
});

// 予約（婚活相談）
const when = new Date(Date.now() + 3 * 24 * 3600 * 1000);
when.setHours(10, 0, 0, 0);
await call("consultations POST", "/api/consultations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ scheduledAt: when.toISOString(), topic: "婚活相談" }),
});

// ショート一覧 / 投稿
await call("shorts GET", "/api/shorts");
const fd2 = new FormData();
fd2.append("file", new File([jpegBuf], "short.jpg", { type: "image/jpeg" }));
fd2.append("caption", "e2e short");
await call("shorts POST", "/api/shorts", { method: "POST", body: fd2 });

// Stripe checkout（URL が返れば決済導線OK）
await call("stripe checkout POST", "/api/stripe/checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ kind: "future_face" }),
});

// 後片付け: テストユーザー削除
const { error: dErr } = await admin.auth.admin.deleteUser(created.user.id);
console.log("cleanup:", dErr ? `NG ${dErr.message}` : "OK");
