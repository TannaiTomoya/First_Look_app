import { SiteFooter, SiteHeader } from "@/components/site-header";
import { PricingCards, PricingPhilosophy } from "@/components/pricing-section";
import { pricingCatalog } from "@/lib/pricing";

export default function PricingPage() {
  return (
    <div>
      <div className="hero-grid">
        <SiteHeader />
        <div className="mx-auto max-w-6xl px-4 py-16 text-white">
          <h1 className="font-display text-4xl font-semibold">料金</h1>
          <p className="mt-2 max-w-xl text-white/75">
            安物買いの銭失いではなく、自己投資の回収速度。定価は下げず、実質価格だけを調整する。
          </p>
        </div>
      </div>
      <section className="mx-auto max-w-6xl px-4 py-12">
        <PricingPhilosophy />
        <PricingCards />
        <div className="mt-10 rounded-3xl border border-line bg-card p-6">
          <h2 className="font-display text-xl font-semibold">コーチセッション</h2>
          <p className="stat-num mt-2 text-3xl">
            ¥{pricingCatalog.coachDefaultJpy.toLocaleString()}〜
          </p>
          <p className="mt-2 text-sm text-muted">
            補助機能。成立時にプラットフォーム手数料 {pricingCatalog.platformFeePercent}%（Stripe Connect）。
          </p>
        </div>
        <p className="mt-8 text-sm text-muted">
          ※ 年額の2年目以降価格は継続優遇として別枠。Stripe上の自動切替は運用で適用（初年度キャンペーンと混同しない）。
        </p>
      </section>
      <SiteFooter />
    </div>
  );
}
