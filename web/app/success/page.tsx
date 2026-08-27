import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";

export default function SuccessPage() {
  return (
    <div>
      <div className="hero-grid">
        <SiteHeader />
      </div>
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card>
          <h1 className="text-2xl font-semibold">決済を受け付けました</h1>
          <p className="mt-2 text-sm text-muted">Webhook 反映後に特典が有効になります。ダッシュボードで確認してください。</p>
        </Card>
      </div>
      <SiteFooter />
    </div>
  );
}
