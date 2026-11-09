/** 顔の構造指標・メッシュ変形を表示する画面に置く注意書き（#12） */
export const MEASUREMENT_NOTES = [
  "1枚の写真から AI が推定した値です。奥行き（鼻の高さ・頬骨の形など）を実際に測ったものではありません。",
  "撮影の角度・距離・表情・明るさで、1回ごとに ±2〜3% ほど変わります。1回の値ではなく数週間の傾向で見てください。",
  "医療・診断を目的としたものではありません。美容医療や治療の判断には使わないでください。",
];

export function MeasurementNotice({ className = "" }: { className?: string }) {
  return (
    <ul className={`list-disc space-y-1 pl-5 text-xs text-muted ${className}`}>
      {MEASUREMENT_NOTES.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}
