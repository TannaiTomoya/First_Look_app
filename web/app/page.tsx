import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button, Card } from "@/components/ui";
import { PricingCards, PricingFootnote, PricingPhilosophy } from "@/components/pricing-section";
import { siteConfig } from "@/lib/config";

const evidence = [
  { k: "3秒", t: "第一印象は接触直後に決まる", d: "会話が始まる前に、評価はほぼ終わっている。" },
  { k: "55%", t: "印象の過半数は視覚情報", d: "メラビアンの法則。見た目が信頼の入口になる。" },
  { k: "70%", t: "清潔感が最重視される", d: "完璧さより、マイナスを作らないことが鍵。" },
];

const features = [
  { t: "成長スタジオ", d: "投稿数値を記録し、AIと音声でSNS作戦会議。切り抜きはショート連携。" },
  { t: "撮影する", d: "顔写真を1枚残す。1日1分で完了。商談・面接・婚活用の撮影ガイド付き。" },
  { t: "美肌診断", d: "顔写真を撮ってAIが肌状態を診断。結果を記録に残せる。" },
  { t: "5分肌チェック + AI", d: "テカリ・赤み・乾燥を画像解析。AIが今日やる1つを指示。" },
  { t: "人相リーディングAI", d: "観相学と第一印象研究に基づき「どう見られやすいか」を読む。出典明記。" },
  { t: "自己紹介自動作成", d: "婚活・面接・商談用の文章を生成して保存。" },
  { t: "婚活チャレンジ（岩手）", d: "県内のパーティー・街コン・公的支援をタイムラインで。" },
  { t: "ショート投稿", d: "mov/mp4からAI自動編集した縦型ショートを生成・投稿。" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <div className="hero-grid text-white">
        <SiteHeader />
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="lp-fade-up">
            <p className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs tracking-wide text-white/90">
              MEN&apos;S BEAUTY OS — AI LOOK TRACKER
            </p>
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              アプリ1つで
              <br />
              ブス撲滅。
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/80 md:text-lg">
              {siteConfig.tagline}。撮影・美肌診断・人相リーディング・婚活サポート・AIショート編集まで、商談・面接・婚活に効く全部をこの1本で。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/register" variant="light">
                無料で体験する
              </Button>
              <Button href="/pricing" variant="ghostDark">
                料金を見る
              </Button>
            </div>
          </div>

          <Card className="lp-fade-up lp-delay-1 border-white/40 bg-white p-5 text-foreground md:p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold tracking-wide text-brand">BEFORE / AFTER</p>
              <p className="text-xs text-muted">記録ベース</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="relative overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-line">
                <div className="aspect-[3/4] bg-[linear-gradient(160deg,#d4d4d8_0%,#a1a1aa_55%,#71717a_100%)]" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3">
                  <p className="text-xs font-semibold text-white">Day 0</p>
                  <p className="text-[11px] text-white/80">感覚だけの自己評価</p>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-indigo-50 ring-1 ring-indigo-200">
                <div className="aspect-[3/4] bg-[linear-gradient(160deg,#c7d2fe_0%,#818cf8_45%,#4f46e5_100%)]" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1e1b4b]/70 to-transparent p-3">
                  <p className="text-xs font-semibold text-white">Today</p>
                  <p className="text-[11px] text-white/85">肌・印象・発信を数値化</p>
                </div>
                <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-brand">
                  +記録
                </span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-3 py-2.5 text-sm">
              <p className="text-muted">変化は感覚ではなく、記録で確認する。</p>
              <span className="shrink-0 font-semibold text-brand">Track → Act</span>
            </div>
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
        <h2 className="font-display text-3xl font-semibold">搭載機能</h2>
        <p className="mt-2 text-muted">メンズ美容に必要なものを全部入れた。迷ったら上から順に。</p>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {features.map((f, i) => (
            <Card key={f.t}>
              <p className="text-xs font-semibold text-brand">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted">{f.d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
        <PricingPhilosophy />
        <PricingCards />
        <PricingFootnote />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <Card tone="dark" className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl font-semibold text-white">
              変化を記録しない人は、変化しない。
            </h2>
            <p className="mt-2 text-white/70">今日の1枚から始めましょう。</p>
          </div>
          <Button href="/register" variant="light" className="shrink-0">
            無料で始める
          </Button>
        </Card>
      </section>
      <SiteFooter />
    </div>
  );
}
