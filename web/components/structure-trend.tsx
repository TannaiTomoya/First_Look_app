import { Card } from "@/components/ui";
import { METRICS, milestoneValues, type DayPoint, type MetricKey } from "@/lib/face-mesh/trend";

const W = 320;
const H = 120;
const PAD = 16;

/** 縦軸は平均の ±5% 以上を確保する。日々の検出誤差（±2〜3%）を大きな変化に見せないため */
const MIN_HALF_SPAN = 0.05;
const TREND_WINDOW = 5;

function Chart({ series, k }: { series: DayPoint[]; k: MetricKey }) {
  const ys = series.map((p) => p[k]);
  const xMax = Math.max(7, ...series.map((p) => p.day));
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const half = Math.max((Math.max(...ys) - Math.min(...ys)) / 2, Math.abs(mid) * MIN_HALF_SPAN);
  const x = (d: number) => PAD + (d / xMax) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - (mid - half)) / (half * 2)) * (H - PAD * 2);
  const trend = series.map((p, i) => {
    const w = series.slice(Math.max(0, i - TREND_WINDOW + 1), i + 1);
    return { day: p.day, v: w.reduce((s, q) => s + q[k], 0) / w.length };
  });
  const path = trend.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full max-w-sm" role="img" aria-label={`${k} の推移`}>
      <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="stroke-line" />
      <text x={PAD} y={10} className="fill-muted text-[9px]">
        {(mid + half).toFixed(2)}
      </text>
      {series.map((p) => (
        <circle key={p.day} cx={x(p.day)} cy={y(p[k])} r={2.5} className="fill-brand/30" />
      ))}
      <path d={path} fill="none" className="stroke-brand" strokeWidth={2} />
      <text x={PAD} y={H - 2} className="fill-muted text-[10px]">
        Day0
      </text>
      <text x={W - PAD} y={H - 2} textAnchor="end" className="fill-muted text-[10px]">
        Day{xMax}
      </text>
    </svg>
  );
}

export function StructureTrend({ series, total }: { series: DayPoint[]; total: number }) {
  if (total === 0) {
    return (
      <Card className="mt-6">
        <h2 className="font-semibold">構造指標の推移</h2>
        <p className="mt-1 text-sm text-muted">
          まだ記録がありません。「今日の1枚」で構造指標の記録に同意すると、ここに推移が表示されます。
        </p>
      </Card>
    );
  }

  const ms = milestoneValues(series);
  const base = ms[0].point;

  return (
    <Card className="mt-6">
      <h2 className="font-semibold">構造指標の推移</h2>
      <p className="mt-1 text-xs text-muted">
        顔の向きを補正した数値です。正面・口を閉じた写真のみ集計（{series.length} 日分 / 全 {total} 件）。1回ごとの誤差が ±2〜3% 程度あるため、点ではなく線（直近{TREND_WINDOW}回の平均）で傾向を見てください。
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="py-2 pr-3 font-medium">指標</th>
              {ms.map((m) => (
                <th key={m.day} className="py-2 pr-3 font-medium">
                  Day{m.day}
                  {m.n > 1 && <span className="ml-1 font-normal">（{m.n}回平均）</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map(({ key, label, note }) => (
              <tr key={key} className="border-b border-line/60">
                <td className="py-2 pr-3">
                  {label}
                  <span className="ml-2 text-xs text-muted">{note}</span>
                </td>
                {ms.map((m) => {
                  const v = m.point?.[key];
                  const diff = v != null && base && m.day > 0 ? ((v - base[key]) / base[key]) * 100 : null;
                  return (
                    <td key={m.day} className="py-2 pr-3 font-mono">
                      {v != null ? v.toFixed(2) : "—"}
                      {diff != null && (
                        <span className="ml-1 text-xs text-muted">
                          ({diff >= 0 ? "+" : ""}
                          {diff.toFixed(1)}%)
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {series.length >= 2 && (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {METRICS.map(({ key, label, note }) => (
            <div key={key}>
              <p className="text-sm font-medium">
                {label}
                <span className="ml-2 text-xs text-muted">{note}</span>
              </p>
              <Chart series={series} k={key} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
