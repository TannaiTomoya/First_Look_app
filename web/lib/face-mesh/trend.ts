export type SnapshotPoint = {
  captured_at: string;
  jaw_ratio: number;
  cheek_width: number;
  face_aspect: number;
  quality_ok: boolean;
  model_version: string;
};

export type MetricKey = "jaw_ratio" | "cheek_width" | "face_aspect";

export const METRICS: Array<{ key: MetricKey; label: string; note: string }> = [
  { key: "jaw_ratio", label: "Jaw Width", note: "顎幅 / 頬幅" },
  { key: "cheek_width", label: "Cheek Width", note: "頬幅 / 目尻間" },
  { key: "face_aspect", label: "Face Ratio", note: "縦 / 頬幅" },
];

/** Day N の比較値は [from, to] 日の平均。範囲内に記録が無ければ空欄 */
export const MILESTONES: Array<{ day: number; from: number; to: number }> = [
  { day: 0, from: 0, to: 3 },
  { day: 7, from: 4, to: 10 },
  { day: 30, from: 23, to: 37 },
  { day: 90, from: 76, to: 104 },
];

const DAY = 24 * 3600 * 1000;

export type DayPoint = SnapshotPoint & { day: number };

/**
 * 最新と同じ算出方式・品質OKの記録だけを使う（方式違いの値は比較できない）。
 * 同じ日の複数記録は平均して1点にする（検出のばらつき対策）。
 */
export function toDaySeries(rows: SnapshotPoint[]): DayPoint[] {
  const latest = rows[rows.length - 1]?.model_version;
  const usable = rows.filter((r) => r.quality_ok && r.model_version === latest);
  if (!usable.length) return [];
  const t0 = Date.parse(usable[0].captured_at);
  const byDay = new Map<number, SnapshotPoint[]>();
  for (const r of usable) {
    const d = Math.floor((Date.parse(r.captured_at) - t0) / DAY);
    byDay.set(d, [...(byDay.get(d) ?? []), r]);
  }
  return [...byDay.entries()].map(([day, rs]) => {
    const mean = (k: MetricKey) => rs.reduce((s, r) => s + r[k], 0) / rs.length;
    return {
      ...rs[rs.length - 1],
      day,
      jaw_ratio: mean("jaw_ratio"),
      cheek_width: mean("cheek_width"),
      face_aspect: mean("face_aspect"),
    };
  });
}

export function milestoneValues(series: DayPoint[]) {
  return MILESTONES.map(({ day, from, to }) => {
    const ps = series.filter((p) => p.day >= from && p.day <= to);
    if (!ps.length) return { day, point: null, n: 0 };
    const mean = (k: MetricKey) => ps.reduce((s, p) => s + p[k], 0) / ps.length;
    const point: Record<MetricKey, number> = {
      jaw_ratio: mean("jaw_ratio"),
      cheek_width: mean("cheek_width"),
      face_aspect: mean("face_aspect"),
    };
    return { day, point, n: ps.length };
  });
}
