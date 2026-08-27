#!/usr/bin/env bash
# Supabase SQL を psql で適用（接続文字列は環境変数のみ。画面に出さない）
# 使い方:
#   export DATABASE_URL='postgresql://postgres.xxxx:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres'
#   ./scripts/apply-supabase-sql.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SQL="$ROOT/supabase/migrations/0001_init.sql"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL が未設定です。"
  echo "Supabase → Project Settings → Database → Connection string (URI) を export して再実行。"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql がありません。Dashboard の SQL Editor に $SQL を貼って実行してください。"
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL"
echo "マイグレーション適用完了"
