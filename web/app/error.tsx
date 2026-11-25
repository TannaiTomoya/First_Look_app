"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/site-header";
import { Button, Card } from "@/components/ui";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center px-4 py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card>
          <h1 className="text-xl font-semibold">表示できませんでした</h1>
          <p className="mt-2 text-sm text-muted">
            一時的な不具合の可能性があります。もう一度お試しください。続く場合は時間をおいてから開いてください。
          </p>
          {error.digest && <p className="mt-2 text-xs text-muted">エラーID: {error.digest}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={() => retry()}>
              もう一度試す
            </Button>
            <Button href="/dashboard" variant="outline">
              ホームへ
            </Button>
          </div>
          <p className="mt-4 text-sm">
            <Link href="/login" className="text-brand">
              ログイン画面へ
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
