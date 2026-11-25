import { NextResponse } from "next/server";
import type { CallbackError } from "@/lib/auth/errors";
import { safeNext } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth・確認メール・パスワード再設定メールの戻り先。
 * code をセッションに交換し、`next`（同一サイト内の相対パスのみ）へ送る。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Supabase 側で失敗した場合（期限切れリンク等）は error / error_code が付いて戻ってくる
  const providerError = searchParams.get("error_code") ?? searchParams.get("error");
  if (providerError) {
    console.error(`[auth/callback] provider error: ${providerError} ${searchParams.get("error_description") ?? ""}`);
    return toLogin(origin, next, /expired|otp/i.test(providerError) ? "link_expired" : "auth");
  }

  if (!code) return toLogin(origin, next, "missing_code");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // 代表例: code verifier が無い（別ブラウザで開いた）、コードの期限切れ・使用済み
    console.error(`[auth/callback] exchange failed: ${error.code ?? ""} ${error.message}`);
    return toLogin(origin, next, "link_expired");
  }

  return NextResponse.redirect(`${origin}${next}`);
}

function toLogin(origin: string, next: string, kind: CallbackError) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", kind);
  if (next !== "/dashboard") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}
