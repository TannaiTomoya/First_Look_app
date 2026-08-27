import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";
import { CheckoutButton } from "@/components/checkout-button";
import { siteConfig } from "@/lib/config";

export default function PricingPage() {
  return (
    <div>
      <div className="hero-grid">
        <SiteHeader />
        <div className="mx-auto max-w-6xl px-4 py-16 text-white">
          <h1 className="font-display text-4xl font-semibold">料金</h1>
          <p className="mt-2 text-white/75">体験の直後に、必要な分だけ。</p>
        </div>
      </div>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold">Future Face 追加</h2>
          <p className="stat-num mt-2 text-4xl">¥{siteConfig.prices.extraSimJpy}</p>
          <p className="mt-2 text-sm text-muted">1パターン目は無料。比較・履歴保存は都度課金。</p>
          <div className="mt-5">
            <CheckoutButton kind="future_face" label="追加パターンを購入" />
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold">Premium サブスク</h2>
          <p className="stat-num mt-2 text-4xl">¥{siteConfig.prices.premiumMonthlyJpy}<span className="text-base text-muted">/月</span></p>
          <p className="mt-2 text-sm text-muted">肌診断無制限・Evolution Card・週次レポート。解約はポータルから。</p>
          <div className="mt-5">
            <CheckoutButton kind="premium" label="プレミアムに登録" variant="accent" />
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold">個別相談</h2>
          <p className="stat-num mt-2 text-4xl">¥{siteConfig.prices.consultJpy.toLocaleString()}</p>
          <p className="mt-2 text-sm text-muted">決済後に Calendly で日程調整。</p>
          <div className="mt-5">
            <CheckoutButton kind="consult" label="相談を予約する" />
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold">コーチセッション</h2>
          <p className="stat-num mt-2 text-4xl">¥{siteConfig.prices.coachSessionDefaultJpy.toLocaleString()}〜</p>
          <p className="mt-2 text-sm text-muted">
            補助機能。成立時にプラットフォーム手数料 {siteConfig.prices.platformFeePercent}%（Stripe Connect）。
          </p>
        </Card>
      </section>
      <SiteFooter />
    </div>
  );
}
