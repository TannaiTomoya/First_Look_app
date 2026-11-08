/** 切り抜きテンプレ A/B */
export type ClipTemplate = {
  key: string;
  label: string;
  description: string;
  clipLen: number;
  typoScale: number; // 相対
  overlay: "heavy" | "light";
};

export const CLIP_TEMPLATES: ClipTemplate[] = [
  {
    key: "punch_12",
    label: "A: パンチ12秒",
    description: "結論テロップ大・短尺。保存率テスト向け",
    clipLen: 12,
    typoScale: 1.15,
    overlay: "heavy",
  },
  {
    key: "standard_15",
    label: "B: 標準15秒",
    description: "バランス型（デフォルト）",
    clipLen: 15,
    typoScale: 1.0,
    overlay: "heavy",
  },
  {
    key: "story_20",
    label: "C: ストーリー20秒",
    description: "説明多め・テロップ控えめ",
    clipLen: 20,
    typoScale: 0.85,
    overlay: "light",
  },
];

export function getTemplate(key?: string | null): ClipTemplate {
  return CLIP_TEMPLATES.find((t) => t.key === key) ?? CLIP_TEMPLATES[1];
}
