export type MetricRow = {
  id?: string;
  platform: string;
  posted_at?: string | null;
  views: number;
  likes: number;
  saves: number;
  comments: number;
  follows_delta: number;
  note?: string | null;
  title?: string | null;
  created_at?: string;
};

export type MetricsSummary = {
  views: number;
  likes: number;
  saves: number;
  comments: number;
  follows_delta: number;
  saveRate: number; // 0-1
  engagementRate: number; // 0-1
  count: number;
};

export function summarizeMetrics(rows: MetricRow[]): MetricsSummary {
  const views = rows.reduce((a, r) => a + (r.views || 0), 0);
  const likes = rows.reduce((a, r) => a + (r.likes || 0), 0);
  const saves = rows.reduce((a, r) => a + (r.saves || 0), 0);
  const comments = rows.reduce((a, r) => a + (r.comments || 0), 0);
  const follows_delta = rows.reduce((a, r) => a + (r.follows_delta || 0), 0);
  return {
    views,
    likes,
    saves,
    comments,
    follows_delta,
    saveRate: views > 0 ? saves / views : 0,
    engagementRate: views > 0 ? (likes + comments) / views : 0,
    count: rows.length,
  };
}

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export const PLATFORMS = ["instagram", "youtube", "tiktok", "x", "other"] as const;
