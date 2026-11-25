import assert from "node:assert/strict";
import { test } from "node:test";
import { authErrorView, callbackErrorView } from "./errors.ts";

test("パスワード違いは日本語＋再設定導線", () => {
  const v = authErrorView({ code: "invalid_credentials", message: "Invalid login credentials" });
  assert.equal(v.message, "メールアドレスかパスワードが違います。");
  assert.equal(v.action, "reset-password");
});

test("未確認メールは再送導線", () => {
  assert.equal(authErrorView({ code: "email_not_confirmed" }).action, "resend-confirmation");
});

test("Google 無効（provider is not enabled）は準備中の案内", () => {
  const v = authErrorView({ code: "validation_failed", message: "Unsupported provider: provider is not enabled" });
  assert.match(v.message, /準備中/);
});

test("通信エラーは接続できない旨", () => {
  assert.match(authErrorView(new TypeError("Failed to fetch")).message, /接続できません/);
});

test("英語のまま出さない", () => {
  const v = authErrorView({ message: "Something unexpected" });
  assert.doesNotMatch(v.message, /[A-Za-z]{4,}/);
});

test("callback の error 種別", () => {
  assert.equal(callbackErrorView(null), null);
  assert.match(callbackErrorView("link_expired")!.message, /別のブラウザ/);
  assert.ok(callbackErrorView("auth"));
});
