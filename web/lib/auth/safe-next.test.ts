import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext } from "./safe-next.ts";

test("同一サイト内の相対パスはそのまま通す", () => {
  assert.equal(safeNext("/dashboard"), "/dashboard");
  assert.equal(safeNext("/growth/abc?tab=1#x"), "/growth/abc?tab=1#x");
  assert.equal(safeNext("%2Fgrowth%2Fplans"), "/growth/plans");
});

test("空・未指定は既定値", () => {
  assert.equal(safeNext(null), "/dashboard");
  assert.equal(safeNext(undefined), "/dashboard");
  assert.equal(safeNext(""), "/dashboard");
  assert.equal(safeNext(null, "/reset-password"), "/reset-password");
});

test("外部サイトへ飛ばす値はすべて既定値に落とす", () => {
  const attacks = [
    "@evil.example",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "%2F%2Fevil.example",
    "%252F%252Fevil.example",
    "/%2F/evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/\tevil",
    "/\n/evil.example",
    "%E0%A4%A",
  ];
  for (const value of attacks) {
    assert.equal(safeNext(value), "/dashboard", `should reject: ${JSON.stringify(value)}`);
  }
});

test("origin と連結しても外部ドメインにならない", () => {
  const origin = "https://firstlook.tomobou5912.workers.dev";
  for (const value of ["@evil.example", "//evil.example", "/\\evil.example", "%2F%2Fevil.example"]) {
    const url = new URL(`${origin}${safeNext(value)}`);
    assert.equal(url.host, "firstlook.tomobou5912.workers.dev");
  }
});
