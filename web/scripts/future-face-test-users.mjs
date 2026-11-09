// Future Face のローカル確認用。年額ユーザーと無料ユーザーを1人ずつ作成／削除する。
//   node scripts/future-face-test-users.mjs create
//   node scripts/future-face-test-users.mjs cleanup
// 表示するのはテストユーザーのログイン情報のみ（サービスキー等は出力しない）。
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PREFIX = "ff-test-";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("env 不足のため中止");
  process.exit(1);
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function testUsers() {
  const out = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    out.push(...data.users.filter((u) => u.email?.startsWith(PREFIX)));
    if (data.users.length < 200) break;
  }
  return out;
}

async function create() {
  const stamp = Date.now();
  for (const plan of ["annual", "free"]) {
    const email = `${PREFIX}${plan}-${stamp}@example.com`;
    const password = `Ff-${Math.random().toString(36).slice(2, 10)}!9`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`${plan}: ${error.message}`);
    if (plan === "annual") {
      const { error: e } = await admin
        .from("entitlements")
        .upsert({ user_id: data.user.id, is_premium: true, plan_interval: "year" });
      if (e) throw new Error(`entitlements: ${e.message}`);
    }
    console.log(`${plan === "annual" ? "年額" : "無料"}: ${email} / ${password}`);
  }
}

async function cleanup() {
  const users = await testUsers();
  for (const u of users) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    console.log(`削除 ${u.email}: ${error ? `NG ${error.message}` : "OK"}`);
  }
  if (!users.length) console.log("削除対象なし");
}

const cmd = process.argv[2];
if (cmd === "create") await create();
else if (cmd === "cleanup") await cleanup();
else console.log("使い方: node scripts/future-face-test-users.mjs create | cleanup");
