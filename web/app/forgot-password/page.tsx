import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "パスワード再設定", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center px-4 py-16">
      <div className="w-full">
        <Suspense>
          <ForgotPasswordForm />
        </Suspense>
        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/login" className="text-brand">ログインに戻る</Link>
        </p>
      </div>
    </div>
  );
}
