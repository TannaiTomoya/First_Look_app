import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";
import { MeasurementNotice } from "@/components/measurement-notice";

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
          <h2 className="mt-6 font-semibold">顔の構造データ</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>同意した場合のみ、写真から算出した顎幅・頬幅・顔の縦横比・顔の向きの数値を保存します。</li>
            <li>顔の検出は端末内で行い、顔の点の座標は保存しません。</li>
            <li>本人以外（運営を含む）は閲覧できません。</li>
            <li>設定から同意を取り消すと、保存済みの数値はその場ですべて削除されます。退会時も削除します。</li>
          </ul>
          <h2 className="mt-6 font-semibold">推定値について</h2>
          <MeasurementNotice className="mt-2 text-sm" />
        </Card>
      </div>
      <SiteFooter />
    </div>
  );
}
