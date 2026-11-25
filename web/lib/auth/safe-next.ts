export const DEFAULT_NEXT = "/dashboard";

/**
 * ログイン後の戻り先（?next=）を、同一サイト内の相対パスだけに制限する。
 * `//evil.example`、`/\evil.example`、`@evil.example`、`https://evil.example` などは既定値に落とす。
 */
export function safeNext(raw: string | null | undefined, fallback: string = DEFAULT_NEXT): string {
  if (!raw) return fallback;
  let value = raw.trim();
  try {
    // 二重エンコード（%2F%2Fevil）もデコードしてから判定する
    for (let i = 0; i < 2 && /%[0-9a-f]{2}/i.test(value); i += 1) value = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // 制御文字・バックスラッシュ（ブラウザが / として解釈する）を拒否
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    const base = "https://firstlook.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
