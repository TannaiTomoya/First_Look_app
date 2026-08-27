#!/usr/bin/env bash
# キーを画面・ログに出さず .env.local 作成 → Cloudflare Worker secrets へ投入
set -euo pipefail
cd "$(dirname "$0")/.."

EXAMPLE="env.local.example"
TARGET=".env.local"

if [[ ! -f "$TARGET" ]]; then
  cp "$EXAMPLE" "$TARGET"
  echo "作成: web/.env.local"
  echo "エディタで実キーを記入して保存してください（チャットには貼らない）。"
  echo "記入後、もう一度このスクリプトを実行します。"
  exit 0
fi

# 必須キーがプレースホルダのままなら停止
if grep -qE 'YOUR_PROJECT_REF|eyJ\.\.\.|pk_test_\.\.\.|sk_test_\.\.\.' "$TARGET"; then
  echo "web/.env.local に実キーを記入してから再実行してください。"
  exit 1
fi

# 公開してよい NEXT_PUBLIC_* は vars、秘密は secrets
set -a
# shellcheck disable=SC1091
source "$TARGET"
set +a

echo "Cloudflare Worker vars / secrets を更新中（値は表示しません）..."

# wrangler の vars は設定ファイル経由が安全。secrets は put
for key in SUPABASE_SERVICE_ROLE_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do
  val="${!key:-}"
  if [[ -n "$val" ]]; then
    printf '%s' "$val" | npx wrangler secret put "$key" >/dev/null
    echo "  secret: $key OK"
  else
    echo "  secret: $key スキップ（未設定）"
  fi
done

# NEXT_PUBLIC と SITE_URL はビルド時に埋め込まれるため .env.production / .dev.vars にも同期
{
  echo "NEXTJS_ENV=production"
  grep -E '^(NEXT_PUBLIC_|SUPABASE_SERVICE_ROLE_KEY|STRIPE_|NEXT_PUBLIC_SITE_URL)' "$TARGET" || true
} > .dev.vars.production.tmp
mv .dev.vars.production.tmp .dev.vars
echo "  .dev.vars を同期しました（デプロイ時に使用）"

echo "完了。続けて: npm run deploy"
