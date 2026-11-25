import Link from "next/link";
import { Logo } from "@/components/site-header";
import { Button, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center px-4 py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card>
          <h1 className="text-xl font-semibold">ページが見つかりません</h1>
          <p className="mt-2 text-sm text-muted">URL が変わったか、削除された可能性があります。</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button href="/dashboard">ホームへ</Button>
            <Button href="/" variant="outline">
              トップへ
            </Button>
          </div>
          <p className="mt-4 text-sm">
            <Link href="/login" className="text-brand">
              ログイン
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
