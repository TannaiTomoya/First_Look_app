# FirstLook

失敗できない場面の前に、第一印象を整える AI Look Tracker。
写真を撮って変化を記録し、必要なときだけ課金する。

現行の公開実装は `web/`（Next.js）。旧 Flask 版はリポジトリ直下に残しています。

## できること

- 認証: メール / Google / LINE（LINE は Supabase のカスタムOIDC設定後）
- 記録: 撮影・保存・Day0/Today 比較
- 課金（Stripe）
  - 都度 ¥500: Future Face 追加パターン
  - 月額 ¥980: Premium
  - 個別相談: 決済後に Calendly
  - コーチセッション: 補助機能。成立時に手数料 15%（Connect）
- 管理者: `/admin`（profiles.role = admin）
- 公開準備: sitemap / robots / OGP

## 技術構成

| 層 | 技術 |
|---|---|
| アプリ | Next.js (App Router, TypeScript) |
| 認証 / DB / 画像 | Supabase Auth + Postgres + Storage |
| 決済 | Stripe Checkout / Billing / Connect |
| 予約 | Calendly（決済後に表示） |
| デプロイ | Cloudflare Workers（OpenNext） |

## セットアップ

```bash
cd web
cp env.local.example .env.local
# .env.local にキーを記入
npm install
npm run dev
```

ブラウザ: http://localhost:3000

### 環境変数（web/.env.local）

| 変数 | 用途 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | プロジェクトURL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 公開anonキー |
| SUPABASE_SERVICE_ROLE_KEY | Webhook用。公開禁止 |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Stripe 公開キー（テスト可） |
| STRIPE_SECRET_KEY | Stripe 秘密キー。公開禁止 |
| STRIPE_WEBHOOK_SECRET | `stripe listen` で取得 |
| NEXT_PUBLIC_CALENDLY_URL | 相談カレンダー埋め込みURL |
| NEXT_PUBLIC_SITE_URL | 本番URL（OGP / リダイレクト） |

`.env` / `.env.example`（Flask用）は変更しません。Next.js は `web/env.local.example` を使います。

### Supabase

1. プロジェクト `firstlook`（Tokyo）を作成済みなら、SQL Editor で `supabase/migrations/0001_init.sql` を実行
2. Authentication → Providers で Email / Google を有効化。LINE はカスタムOIDC
3. 管理者にするユーザーは Table Editor で `profiles.role` を `admin` に変更

### Stripe 動作確認（テストモード）

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

1. ログイン
2. `/pricing` から都度課金・サブスクをテストカード `4242` で実行
3. ダッシュボードで特典が付くこと
4. `/settings` の課金ポータルで解約できること

## デプロイ（Cloudflare）

本番（現在）: `https://firstlook.<account>.workers.dev`  
※ `*.workers.dev` はアカウント名サブドメインが必須。`.tomobou5912` を消すには **独自ドメイン** を Worker に紐づける。

```bash
cd web
cp env.local.example .env.local   # 実キーを記入（チャットに貼らない）
./scripts/sync-secrets.sh         # Cloudflare secrets へ投入
npm run deploy
```

Webhook: `https://<本番ドメイン>/api/stripe/webhook`

### 初回セットアップ手順

1. Supabase SQL Editor で `supabase/migrations/0001_init.sql` を実行  
   （または `DATABASE_URL=... ./web/scripts/apply-supabase-sql.sh`）
2. `web/.env.local` に URL / anon / service_role / Stripe キーを記入  
   ※ anon は `eyJ...` 形式。プロジェクトIDやリージョン名ではない
3. `./web/scripts/sync-secrets.sh` → `npm run deploy`
4. Stripe Dashboard → Webhooks → 上記 URL を追加（イベント: `checkout.session.completed`, `customer.subscription.*`）

## ディレクトリ

```
web/                 Next.js アプリ
  app/               LP・認証・ダッシュボード・API
  components/        UI
  lib/               Supabase / Stripe
supabase/migrations  Postgres + RLS
```

## 旧Flask版

Render の現行URLは移行完了まで並行稼働可能。予約 Blueprint は未配線のため、予約は Calendly + Stripe に置き換え。
