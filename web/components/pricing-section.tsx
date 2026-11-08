import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { CheckoutButton } from "@/components/checkout-button";
import {
  discountPercent,
  monthlyEffectivePerYear,
  pricingCatalog,
  pricingCopy,
} from "@/lib/pricing";

export function PricingPhilosophy() {
  return (
    <div className="mb-10">
      <h2 className="font-display text-3xl font-semibold tracking-tight">{pricingCopy.headline}</h2>
      <p className="mt-2 max-w-2xl text-muted">{pricingCopy.sub}</p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {pricingCopy.principles.map((p) => (
          <div key={p.t} className="rounded-2xl border border-line bg-card/80 px-4 py-3">
            <p className="text-sm font-semibold text-brand">{p.t}</p>
            <p className="mt-1 text-sm text-muted">{p.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PricingCards({ showConsult = true }: { showConsult?: boolean }) {
  const m = pricingCatalog.monthly;
  const a = pricingCatalog.annual;
  const y1Off = discountPercent(a.listJpy, a.year1Jpy);
  const y2Off = discountPercent(a.listJpy, a.year2PlusJpy);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <p className="text-sm font-medium text-brand">{pricingCatalog.free.name}</p>
        <p className="stat-num mt-1 text-4xl font-semibold">¥0</p>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {pricingCatalog.free.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <Button href="/register" variant="outline" className="mt-6 w-full">
          無料ではじめる
        </Button>
      </Card>

      <Card>
        <p className="text-sm font-medium text-brand">{m.name}</p>
        <p className="mt-1 text-xs text-muted">
          定価 <span className="line-through">¥{m.listJpy.toLocaleString()}</span>/月
        </p>
        <p className="stat-num mt-1 text-4xl font-semibold">
          ¥{m.introJpy.toLocaleString()}
          <span className="text-base font-medium text-muted">/月</span>
        </p>
        <p className="mt-1 text-xs text-brand">期間限定の実質価格（定価は維持）</p>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {m.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
          <li className="text-foreground/80">年額限定機能は含まれません</li>
        </ul>
        <div className="mt-6">
          <CheckoutButton kind="premium" label="月額ではじめる" variant="outline" className="w-full" />
        </div>
      </Card>

      <Card className="ring-2 ring-brand">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-brand">{a.name}</p>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
            推奨 · LTV
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          定価 <span className="line-through">¥{a.listJpy.toLocaleString()}</span>/年
        </p>
        <p className="stat-num mt-1 text-4xl font-semibold">
          ¥{a.year1Jpy.toLocaleString()}
          <span className="text-base font-medium text-muted">/初年度</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          実質 ¥{monthlyEffectivePerYear(a.year1Jpy).toLocaleString()}/月相当 · 定価より約{y1Off}%OFF
        </p>
        <div className="mt-3 rounded-2xl border border-line bg-zinc-50 px-3 py-2 text-xs text-muted">
          <p>
            <span className="font-semibold text-foreground">初年度キャンペーン</span>
            ：¥{a.year1Jpy.toLocaleString()}（期間限定）
          </p>
          <p className="mt-1">
            <span className="font-semibold text-foreground">2年目以降の継続優遇</span>
            ：¥{a.year2PlusJpy.toLocaleString()}/年（約{y2Off}%OFF・キャンペーンとは別枠）
          </p>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {a.sharedFeatures.map((f) => (
            <li key={f}>{f}</li>
          ))}
          {a.exclusiveFeatures.map((f) => (
            <li key={f}>
              <span className="font-medium text-brand">年額限定</span> {f}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <CheckoutButton kind="premium_annual" label="年額で投資する" className="w-full" />
        </div>
      </Card>

      {showConsult && (
        <Card className="lg:col-span-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-brand">{pricingCatalog.consult.name}</p>
              <p className="mt-1 text-xs text-muted">
                定価 <span className="line-through">¥{pricingCatalog.consult.listJpy.toLocaleString()}</span>
                {" · "}
                実質 ¥{pricingCatalog.consult.introJpy.toLocaleString()}（期間限定）
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                {pricingCatalog.consult.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
            <div className="w-full shrink-0 md:w-56">
              <CheckoutButton kind="consult" label="相談を予約する" variant="outline" />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export function PricingFootnote() {
  return (
    <p className="mt-6 text-sm text-muted">
      価格の本質は原価ではなく、積み上げた時間と経験の対価。安価を待つ遅延は機会損失になります。
      コーチセッションは成立時に手数料 {pricingCatalog.platformFeePercent}% 。
      <Link href="/pricing" className="ml-1 font-medium text-brand hover:underline">
        料金の考え方
      </Link>
    </p>
  );
}
