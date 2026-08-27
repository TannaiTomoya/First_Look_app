import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";

export default function PrivacyPage() {
  return (
    <div>
      <div className="hero-grid">
        <SiteHeader />
      </div>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <h1 className="text-2xl font-semibold">プライバシーポリシー</h1>
          <p className="mt-4 text-sm text-muted">
            顔写真・肌診断データは本人のアカウントに紐づけて保存し、第三者に販売しません。
            決済情報は Stripe が処理し、当アプリはカード番号を保持しません。
          </p>
        </Card>
      </div>
      <SiteFooter />
    </div>
  );
}
