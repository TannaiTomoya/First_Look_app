import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center px-4 py-16">
      <div className="w-full">
        <Suspense>
          <AuthForm mode="login" />
        </Suspense>
        <p className="mt-4 text-center text-sm text-muted">
          アカウントがない場合は <Link href="/register" className="text-brand">新規登録</Link>
        </p>
      </div>
    </div>
  );
}
