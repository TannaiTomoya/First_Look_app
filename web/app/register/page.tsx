import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center px-4 py-16">
      <div className="w-full">
        <Suspense>
          <AuthForm mode="register" />
        </Suspense>
        <p className="mt-4 text-center text-sm text-muted">
          すでにアカウントがある場合は <Link href="/login" className="text-brand">ログイン</Link>
        </p>
      </div>
    </div>
  );
}
