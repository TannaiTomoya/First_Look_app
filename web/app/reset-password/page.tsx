import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "新しいパスワード", robots: { index: false } };

/** 再設定メールのリンク → /auth/callback でセッション確立 → ここ（middleware で要ログイン） */
export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center px-4 py-16">
      <div className="w-full">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
