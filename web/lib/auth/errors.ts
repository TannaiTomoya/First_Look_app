/** Supabase Auth のエラーを、利用者が次に何をすればよいか分かる日本語にする */

export type AuthErrorView = {
  message: string;
  /** 画面に出す追加の操作 */
  action?: "reset-password" | "resend-confirmation" | "register";
};

type ErrorLike = { code?: string; message?: string; status?: number; name?: string };

export function authErrorView(err: unknown): AuthErrorView {
  const e = (err ?? {}) as ErrorLike;
  const code = e.code ?? "";
  const msg = e.message ?? "";

  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) {
    return {
      message: "メールアドレスかパスワードが違います。",
      action: "reset-password",
    };
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(msg)) {
    return {
      message: "メールアドレスの確認が終わっていません。届いた確認メールのリンクを開いてください。",
      action: "resend-confirmation",
    };
  }
  if (code === "user_already_exists" || /already registered/i.test(msg)) {
    return { message: "このメールアドレスは登録済みです。ログインしてください。" };
  }
  if (code === "weak_password" || /password should be/i.test(msg)) {
    return { message: "パスワードが弱すぎます。8文字以上で、英字と数字を混ぜてください。" };
  }
  if (code === "same_password") {
    return { message: "以前と同じパスワードは使えません。" };
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || e.status === 429) {
    return { message: "短時間に操作が集中しました。数分おいてから再度お試しください。" };
  }
  if (code === "validation_failed" && /provider is not enabled/i.test(msg)) {
    return { message: "このログイン方法は現在準備中です。メールアドレスでログインしてください。" };
  }
  if (e.name === "AuthRetryableFetchError" || /failed to fetch|network|fetch failed|load failed/i.test(msg)) {
    return { message: "サーバーに接続できません。通信環境を確認し、時間をおいて再度お試しください。" };
  }
  return { message: "うまくいきませんでした。時間をおいて再度お試しください。" };
}

/** /auth/callback から /login?error=… に渡す種別 */
export type CallbackError = "link_expired" | "missing_code" | "auth";

export function callbackErrorView(kind: string | null): AuthErrorView | null {
  switch (kind) {
    case null:
    case "":
      return null;
    case "link_expired":
      return {
        message:
          "リンクの有効期限が切れているか、登録したときとは別のブラウザで開かれました。もう一度ログインしてください。",
        action: "resend-confirmation",
      };
    case "missing_code":
      return { message: "ログイン情報を受け取れませんでした。もう一度お試しください。" };
    default:
      return { message: "ログインを完了できませんでした。もう一度お試しください。" };
  }
}
