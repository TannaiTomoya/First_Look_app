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

# 必須キーがプレースホルダのままなら停止（コメント行は無視）
if grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY|STRIPE_SECRET_KEY)=' "$TARGET" \
  | grep -qE 'YOUR_PROJECT_REF|eyJ\.\.\.|pk_test_\.\.\.|sk_test_\.\.\.'; then
  echo "web/.env.local に実キーを記入してから再実行してください。"
  exit 1
fi

# 公開してよい NEXT_PUBLIC_* は vars、秘密は secrets
set -a
# shellcheck disable=SC1091
source "$TARGET"
set +a

echo "Cloudflare Worker vars / secrets を更新中（値は表示しません）..."

is_placeholder() {
  local v="$1"
  [[ -z "$v" ]] && return 0
  [[ "$v" == *'...'* ]] && return 0
  [[ "$v" == *YOUR_PROJECT_REF* ]] && return 0
  return 1
}

# wrangler の vars は設定ファイル経由が安全。secrets は put
for key in SUPABASE_SERVICE_ROLE_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do
  val="${!key:-}"
  if is_placeholder "$val"; then
    echo "  secret: $key スキップ（未設定/プレースホルダ）"
  else
    printf '%s' "$val" | npx wrangler secret put "$key" >/dev/null
    echo "  secret: $key OK"
  fi
done

# NEXT_PUBLIC はビルド時に埋め込まれる。runtime 用に .dev.vars へ同期（プレースホルダ除外）
{
  echo "NEXTJS_ENV=production"
  while IFS='=' read -r k v; do
    [[ "$k" =~ ^(NEXT_PUBLIC_|SUPABASE_SERVICE_ROLE_KEY|STRIPE_) ]] || continue
    is_placeholder "$v" && continue
    printf '%s=%s\n' "$k" "$v"
  done < "$TARGET"
} > .dev.vars.production.tmp
mv .dev.vars.production.tmp .dev.vars
echo "  .dev.vars を同期しました（デプロイ時に使用）"

echo "完了。続けて: npm run deploy"
