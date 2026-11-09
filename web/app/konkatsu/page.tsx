import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";

type Item = { tag: string; title: string; body: string; url: string; source: string };

const PARTY: Item[] = [
  {
    tag: "婚活パーティー",
    title: "岩手の婚活パーティー・お見合いカレンダー",
    body: "盛岡を中心に、直近開催のパーティーが日付順に一覧できる。まずはここで今月の予定を確認。",
    url: "https://party-calendar.net/area/iwate/unit-3201",
    source: "party-calendar.net",
  },
  {
    tag: "婚活パーティー",
    title: "PARTY☆PARTY 盛岡エリア",
    body: "個室型・少人数の婚活イベント。年齢帯や年収帯で絞り込み可能。",
    url: "https://www.partyparty.jp/pref_iwate/area_morioka",
    source: "partyparty.jp",
  },
  {
    tag: "街コン",
    title: "machicon JAPAN 盛岡・20代向け婚活特集",
    body: "盛岡の20代向け街コン・婚活イベント特集。趣味コン・食事会形式も多い。",
    url: "https://machicon.jp/areas/iwate/ag0300/morioka/features/twenties-konkatsu/",
    source: "machicon.jp",
  },
  {
    tag: "婚活パーティー",
    title: "エクシオ 盛岡会場",
    body: "全国大手の定期開催パーティー。初参加サポートあり。",
    url: "https://www.exeo-japan.co.jp/location/629",
    source: "exeo-japan.co.jp",
  },
];

const SUPPORT: Item[] = [
  {
    tag: "公的支援",
    title: "いきいき岩手結婚サポートセンター（i-サポ）",
    body: "岩手県の公的マッチングセンター。会員登録して1対1の出会いを紹介してもらえる。",
    url: "https://www.ikiiki-iwate.com/",
    source: "ikiiki-iwate.com",
  },
  {
    tag: "自治体",
    title: "一関市の婚活支援",
    body: "一関市が実施する出会い・結婚支援の情報ページ。",
    url: "https://www.city.ichinoseki.iwate.jp/archive/contents-124894",
    source: "city.ichinoseki.iwate.jp",
  },
  {
    tag: "自治体",
    title: "葛巻町の結婚支援",
    body: "葛巻町の結婚支援・イベント情報。",
    url: "https://www.town.kuzumaki.lg.jp/docs/2024111400014/",
    source: "town.kuzumaki.lg.jp",
  },
  {
    tag: "相談所",
    title: "岩手の結婚相談所まとめ（town.ma0rry）",
    body: "県内の結婚相談所の比較・一覧。料金と成婚実績で選ぶ。",
    url: "https://town.ma0rry.com/iwate/",
    source: "town.ma0rry.com",
  },
];

const SNS: Item[] = [
  {
    tag: "SNS",
    title: "musubiz_tohoku（Instagram）",
    body: "東北の婚活・出会いイベント情報を発信。",
    url: "https://www.instagram.com/musubiz_tohoku",
    source: "Instagram",
  },
  {
    tag: "SNS",
    title: "millions5com（Instagram）",
    body: "イベント・婚活関連の発信アカウント。",
    url: "https://www.instagram.com/millions5com",
    source: "Instagram",
  },
  {
    tag: "SNS",
    title: "tomoyuki_taguchi（Instagram）",
    body: "婚活・出会い関連の発信アカウント。",
    url: "https://www.instagram.com/tomoyuki_taguchi",
    source: "Instagram",
  },
];

function Timeline({ items }: { items: Item[] }) {
  return (
    <div className="space-y-4 border-l-2 border-accent/30 pl-5">
      {items.map((item, i) => (
        <Card key={i} className="relative">
          <span className="absolute -left-[27px] top-7 h-3 w-3 rounded-full bg-accent" />
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent">{item.tag}</span>
            <span className="text-muted">{item.source}</span>
          </div>
          <h3 className="mt-2 font-semibold">{item.title}</h3>
          <p className="mt-1 text-sm text-muted">{item.body}</p>
          <Link
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-semibold text-brand underline underline-offset-4"
          >
            最新情報を見る →
          </Link>
        </Card>
      ))}
    </div>
  );
}

export const metadata = { title: "婚活・恋愛チャレンジ | FirstLook" };

export default function KonkatsuPage() {
  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">婚活・恋愛チャレンジ（岩手）</h1>
      <p className="mt-1 text-sm text-muted">
        岩手県内の婚活パーティー・街コン・公的支援・SNSの情報源をタイムラインで。各リンク先で最新の開催日程が見られます。
      </p>

      <Card className="mt-6 bg-brand/5">
        <h2 className="font-semibold">はじめる前の3ステップ</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>
            <Link href="/capture" className="text-brand underline underline-offset-2">今日の1枚</Link>
            で現状を記録 →{" "}
            <Link href="/skin" className="text-brand underline underline-offset-2">美肌診断</Link>{" "}
            /{" "}
            <Link href="/skin-check" className="text-brand underline underline-offset-2">5分肌チェック</Link>
          </li>
          <li>
            <Link href="/intro" className="text-brand underline underline-offset-2">自己紹介を自動作成</Link>
            してプロフィール文を用意
          </li>
          <li>下のイベントから1つ申し込む（迷ったら公的支援の i-サポが低コスト）</li>
        </ol>
        <div className="mt-4">
          <Button href="/consult">丹内 智弥に婚活相談する</Button>
        </div>
      </Card>

      <h2 className="mt-8 font-display text-xl font-semibold">婚活パーティー・街コン</h2>
      <div className="mt-4">
        <Timeline items={PARTY} />
      </div>

      <h2 className="mt-8 font-display text-xl font-semibold">結婚相談所・自治体・公的支援</h2>
      <div className="mt-4">
        <Timeline items={SUPPORT} />
      </div>

      <h2 className="mt-8 font-display text-xl font-semibold">SNSで情報を追う</h2>
      <div className="mt-4">
        <Timeline items={SNS} />
      </div>

      <p className="mt-6 text-xs text-muted">
        ※ 開催情報は各サイト・アカウントの最新掲載を確認してください。掲載元への自動巡回・取り込みは今後のアップデートで対応予定です。
      </p>
    </AppShell>
  );
}
