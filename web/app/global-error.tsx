"use client";

import Link from "next/link";

/** ルートレイアウト自体が落ちたとき用。グローバル CSS が効かないのでインラインで最小限に整える */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "64px 16px", background: "#faf9f6" }}>
        <title>エラー | FirstLook</title>
        <main style={{ maxWidth: 420, margin: "0 auto" }}>
          <h1 style={{ fontSize: 20 }}>表示できませんでした</h1>
          <p style={{ fontSize: 14, color: "#555" }}>時間をおいて、もう一度お試しください。</p>
          {error.digest && <p style={{ fontSize: 12, color: "#888" }}>エラーID: {error.digest}</p>}
          <p style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button type="button" onClick={() => retry()} style={{ padding: "8px 16px" }}>
              もう一度試す
            </button>
            <Link href="/" style={{ padding: "8px 0" }}>
              トップへ
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
