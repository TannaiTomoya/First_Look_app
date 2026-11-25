/** AI が応答しなかったとき（簡易版の結果を表示しているとき）に出す注記 */
export function AiFallbackNotice({ show, className }: { show: boolean; className?: string }) {
  if (!show) return null;
  return (
    <p
      role="status"
      className={`rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 ${className ?? ""}`}
    >
      AI に接続できなかったため、簡易版の結果を表示しています。利用回数は消費していません。時間をおいて再度お試しください。
    </p>
  );
}
