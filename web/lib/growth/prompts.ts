import type { MetricsSummary, MetricRow } from "./metrics";
import { formatPct } from "./metrics";

export function buildCoachSystemContext(
  summary: MetricsSummary,
  recent: MetricRow[],
  intro?: string | null,
): string {
  const lines = recent.slice(0, 8).map((r) => {
    const title = r.title || r.note || "(無題)";
    return `- [${r.platform}] ${title}: views=${r.views} likes=${r.likes} saves=${r.saves} comments=${r.comments} followsΔ=${r.follows_delta}`;
  });
  return [
    "あなたはメンズ美容・第一印象・婚活発信のSNSコーチです。",
    "数値を見て「続いている型」を短く言語化し、次の実験（投稿1本）を提案してください。",
    "医療診断・差別・断定は禁止。観察→仮説→次の実験 の順で、日本語で簡潔に。",
    "",
    "【ユーザーの自己紹介メモ】",
    intro?.trim() || "（未登録）",
    "",
    "【直近KPIサマリー】",
    `投稿数=${summary.count} views=${summary.views} 保存率=${formatPct(summary.saveRate)} 反応率=${formatPct(summary.engagementRate)} フォロワー増減=${summary.follows_delta}`,
    "",
    "【直近の投稿ログ】",
    lines.length ? lines.join("\n") : "（まだ数値未登録）",
  ].join("\n");
}

export function heuristicCoachReply(userMessage: string, summary: MetricsSummary): string {
  const tips: string[] = [];
  tips.push(`観察: 直近${summary.count}投稿で再生${summary.views}・保存率${formatPct(summary.saveRate)}。`);
  if (summary.saveRate >= 0.05) {
    tips.push("仮説: 保存される＝「後で真似したい」内容。ビフォー→手順→1アクションの型が効いている可能性。");
  } else if (summary.views > 0) {
    tips.push("仮説: 再生はあるが保存が弱い。冒頭1秒の結論（例:「眉下1列だけ」）を先に出す実験を。");
  } else {
    tips.push("仮説: まず数字を1本分入れるか、shortsで縦型を1本出して母数を作る段階。");
  }
  tips.push(
    `次の実験: 「${userMessage.slice(0, 40) || "今日の1アクション"}」を15秒で話し、テロップは結論だけ。投稿後にviews/savesを記録。`,
  );
  return tips.join("\n");
}
