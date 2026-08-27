import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button, Card } from "@/components/ui";
import { CheckoutButton } from "@/components/checkout-button";
import { siteConfig } from "@/lib/config";

const evidence = [
  { k: "3秒", t: "第一印象は接触直後に決まる", d: "会話が始まる前に、評価はほぼ終わっている。" },
  { k: "55%", t: "印象の過半数は視覚情報", d: "メラビアンの法則。見た目が信頼の入口になる。" },
  { k: "70%", t: "清潔感が最重視される", d: "完璧さより、マイナスを作らないことが鍵。" },
];

const features = [
  { t: "撮影する", d: "顔写真を1枚残す。1日1分で完了。" },
  { t: "Future Face", d: "変化の方向をシミュレーション。" },
  { t: "Daily Loop", d: "今日やることを1つだけ提示。" },
  { t: "Timeline", d: "Day0とTodayを自動比較。" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <div className="hero-grid text-white">
        <SiteHeader />
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs tracking-wide">
              AI LOOK TRACKER
            </p>
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              {siteConfig.tagline}
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/75 md:text-lg">
              商談・面接・婚活の前に。写真を撮るだけで変化を記録し、最低限の清潔感を安定させる。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/register" className="bg-white text-brand hover:bg-zinc-100">
                無料で体験する
              </Button>
              <Button href="/pricing" variant="ghost" className="border border-white/20 text-white hover:bg-white/10">
                料金を見る
              </Button>
            </div>
          </div>
          <Card className="bg-white/95">
            <p className="text-sm font-medium text-brand">BEFORE / AFTER</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="aspect-[3/4] rounded-2xl bg-gradient-to-b from-zinc-200 to-zinc-400 p-3 text-xs text-zinc-700">
                Day 0
              </div>
              <div className="aspect-[3/4] rounded-2xl bg-gradient-to-b from-indigo-200 to-violet-400 p-3 text-xs text-indigo-950">
                Today
              </div>
            </div>
            <p className="mt-4 text-sm text-muted">変化は感覚ではなく、記録で確認する。</p>
          </Card>
        </section>
      </div>

      <section id="evidence" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl font-semibold tracking-tight">動いただけでは、完成ではない。</h2>
        <p className="mt-2 text-muted">根拠があるから、続ける理由がある。</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {evidence.map((item) => (
            <Card key={item.k}>
              <p className="stat-num text-5xl font-semibold text-brand">{item.k}</p>
              <h3 className="mt-3 font-semibold">{item.t}</h3>
              <p className="mt-2 text-sm text-muted">{item.d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="font-display text-3xl font-semibold">使い方は4ステップ</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {features.map((f, i) => (
            <Card key={f.t}>
              <p className="text-xs font-semibold text-brand">0{i + 1}</p>
              <h3 className="mt-2 font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted">{f.d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl font-semibold">価値を体験した瞬間に、課金。</h2>
        <p className="mt-2 text-muted">基本は無料。追加シミュレーションと継続サポートだけ有料。</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card>
            <p className="text-sm text-brand">無料</p>
            <p className="stat-num mt-1 text-4xl font-semibold">¥0</p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li>撮影・記録</li>
              <li>Daily Loop</li>
              <li>基本Timeline</li>
            </ul>
            <Button href="/register" variant="outline" className="mt-6 w-full">
              はじめる
            </Button>
          </Card>
          <Card className="ring-2 ring-brand">
            <p className="text-sm text-brand">都度課金</p>
            <p className="stat-num mt-1 text-4xl font-semibold">¥{siteConfig.prices.extraSimJpy}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li>Future Face 追加パターン</li>
              <li>比較表示・履歴保存</li>
            </ul>
            <div className="mt-6">
              <CheckoutButton kind="future_face" label="追加パターンを買う" />
            </div>
          </Card>
          <Card>
            <p className="text-sm text-brand">Premium</p>
            <p className="stat-num mt-1 text-4xl font-semibold">¥{siteConfig.prices.premiumMonthlyJpy}<span className="text-base font-medium text-muted">/月</span></p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li>AI肌診断 無制限</li>
              <li>Evolution Card</li>
              <li>週次レポート</li>
            </ul>
            <div className="mt-6">
              <CheckoutButton kind="premium" label="プレミアムにする" variant="accent" />
            </div>
          </Card>
        </div>
        <p className="mt-6 text-sm text-muted">
          個別相談は Calendly 予約（¥{siteConfig.prices.consultJpy.toLocaleString()}）。コーチセッションは成立時にプラットフォーム手数料 {siteConfig.prices.platformFeePercent}% 。
          <Link href="/pricing" className="ml-1 text-brand">詳細</Link>
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <Card className="flex flex-col items-start justify-between gap-6 bg-[#120d1c] text-white md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl font-semibold">変化を記録しない人は、変化しない。</h2>
            <p className="mt-2 text-white/70">今日の1枚から始めましょう。</p>
          </div>
          <Button href="/register" className="bg-white text-brand hover:bg-zinc-100">
            無料で始める
          </Button>
        </Card>
      </section>
      <SiteFooter />
    </div>
  );
}
