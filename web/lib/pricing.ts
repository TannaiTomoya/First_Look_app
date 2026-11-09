/**
 * LTV重視の課金カタログ。
 * - 定価は高めに維持し、実質価格は期間限定割引で調整（価格流動性）
 * - 初年度キャンペーンと2年目以降の継続優遇を分離
 * - 年額限定機能で月額からのアップグレード動機を設計
 */

export type PlanInterval = "none" | "month" | "year";

export const pricingCatalog = {
  free: {
    name: "無料",
    priceJpy: 0,
    features: [
      "撮影・記録・Daily Loop",
      "美肌診断・人相・自己紹介（基本）",
      "Growth / ショート（月次上限あり）",
    ],
  },
  monthly: {
    name: "Premium 月額",
    /** 定価（値下げしない基準。将来のコスト変動に備える） */
    listJpy: 2980,
    /** 期間限定の実質価格（クーポン相当。定価とは別管理） */
    introJpy: 1980,
    interval: "month" as const,
    features: [
      "AI肌診断 無制限",
      "音声コーチ無制限",
      "クリップ月50本 / 録画60分",
      "Evolution Card・週次サマリー",
    ],
  },
  annual: {
    name: "Premium 年額",
    /** 定価 = 月額定価 × 12 */
    listJpy: 35760,
    /** 初年度のみのキャンペーン価格（継続優遇とは別枠） */
    year1Jpy: 17880,
    /** 2年目以降の継続優遇価格（長期利用者が損しない構造） */
    year2PlusJpy: 23880,
    interval: "year" as const,
    /** 年額限定：高度AI・拡張をここに集約 */
    exclusiveFeatures: [
      "YouTube統計インポート",
      "発信プランAI 無制限",
      "切り抜きテンプレ A/B/C 全開放",
      "クリップ月100本",
      "週次レポート詳細版",
    ],
    sharedFeatures: [
      "月額Premiumの全機能を含む",
      "行動変容に必要な継続期間を価格で支える",
    ],
  },
  consult: {
    name: "個別相談（丹内 智弥）",
    listJpy: 9800,
    introJpy: 4980,
    features: ["第一印象・婚活の作戦会議", "相談後の発信プラン連動"],
  },
  coachDefaultJpy: 5000,
  platformFeePercent: 15,
} as const;

export function monthlyEffectivePerYear(annualJpy: number) {
  return Math.round(annualJpy / 12);
}

export function discountPercent(listJpy: number, saleJpy: number) {
  if (listJpy <= 0) return 0;
  return Math.round((1 - saleJpy / listJpy) * 100);
}

export const pricingCopy = {
  headline: "安さではなく、自己投資の回収速度で選ぶ。",
  sub:
    "知識と行動変容には時間がかかる。だから年額で継続しやすくし、定価は下げずに実質価格だけを調整する。",
  principles: [
    {
      t: "LTVを優先",
      d: "短期売上の月額より、継続期間を伸ばす年額割引を厚く設計。",
    },
    {
      t: "年額限定の高度機能",
      d: "YouTube取込・発信プラン無制限・全テンプレなど、価値ある拡張を年額特典に集約。",
    },
    {
      t: "初年度と継続優遇を分離",
      d: "キャンペーンと2年目以降のディスカウントを分け、長期利用者が損しない。",
    },
    {
      t: "定価は高く、実質は柔軟に",
      d: "定価を下げると値上げが困難。クーポン型の実質価格で市場に合わせる。",
    },
  ],
} as const;
