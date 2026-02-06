# Render.com デプロイ完全ガイド 🚀

## 前提条件の確認

✅ **すでに完了している項目:**
- [x] Procfile 作成済み
- [x] requirements.txt 作成済み
- [x] runtime.txt 作成済み（Python 3.11）
- [x] .env.example 作成済み
- [x] .gitignore で .env 除外済み
- [x] 環境変数対応実装済み（FIRSTLOOK_DB_PATH, FIRSTLOOK_UPLOAD_DIR等）
- [x] ヘルスチェックエンドポイント `/healthz` 実装済み

---

## ステップ1: GitHubへのプッシュ 📤

### 1-1. 変更内容の確認

```bash
cd /Users/tannaitomoya/camp/python/FirstLook_app
git status
```

**現在の変更:**
- 修正: `.env.example`, `README.md`, `app.py`, `config.py`, `requirements.txt`, `utils/uploads.py`
- 新規: `Procfile`, `runtime.txt`, `routes/system.py`, 完了レポート（3ファイル）

### 1-2. 変更をコミット

```bash
# 本番デプロイに必要なファイルのみ追加
git add Procfile
git add runtime.txt
git add requirements.txt
git add config.py
git add app.py
git add .env.example
git add README.md
git add routes/system.py
git add utils/uploads.py

# コミット
git commit -m "feat: add production deployment support (Render.com ready)

- Add Procfile for Gunicorn startup
- Add runtime.txt (Python 3.11)
- Add healthcheck endpoint (/healthz)
- Add persistent storage support (FIRSTLOOK_UPLOAD_DIR, FIRSTLOOK_LOG_DIR)
- Update config for production environment
- Add system routes blueprint for healthcheck
"

# プッシュ
git push origin main
```

**オプション: 完了レポートもコミット（推奨）**
```bash
git add TASK_04-2_COMPLETE_FINAL.md
git add TASK_04-3_COMPLETE.md
git commit -m "docs: add deployment task completion reports"
git push origin main
```

---

## ステップ2: Render.com アカウント作成 🔐

### 2-1. アカウント登録

1. **Render.com にアクセス**: https://render.com
2. **Sign Up** をクリック
3. **GitHub連携でサインアップ**（推奨）
   - "Sign up with GitHub" をクリック
   - GitHubで認証
   - Renderが自動的にリポジトリにアクセス可能に

**または Email でサインアップ:**
- Email + パスワードで登録
- 後でGitHub連携を設定

### 2-2. GitHub連携（Emailでサインアップした場合）

1. ダッシュボード右上のアイコン → **Account Settings**
2. 左メニュー → **GitHub**
3. **Connect GitHub Account** をクリック
4. GitHubで認証・許可

---

## ステップ3: Web Service 作成 🌐

### 3-1. 新規サービス作成

1. Renderダッシュボード: https://dashboard.render.com
2. **New +** ボタン → **Web Service** をクリック

### 3-2. リポジトリ選択

**GitHub連携の場合:**
1. "Connect a repository" セクション
2. あなたのGitHubアカウントが表示される
3. **FirstLook_app** リポジトリを探す
4. **Connect** ボタンをクリック

**リポジトリが表示されない場合:**
1. **Configure GitHub App** をクリック
2. リポジトリアクセス権限を付与
3. 戻って再読み込み

### 3-3. 基本設定

| 項目 | 設定値 |
|------|--------|
| **Name** | `firstlook-app`（または任意の名前） |
| **Region** | `Singapore`（日本に最も近い） |
| **Branch** | `main` |
| **Root Directory** | 空欄（プロジェクトルートを使用） |
| **Runtime** | `Python 3`（自動検出） |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | 空欄（Procfileを自動使用） |

**重要:**
- "Start Command" は**空欄のまま**にする → Procfileが自動的に使用される
- Procfileがある場合、手動設定は不要

---

## ステップ4: 環境変数設定 🔑

### 4-1. Environment Variables セクション

"Environment" タブで以下を追加:

```bash
# 環境設定
FLASK_ENV=production

# セキュリティ（重要！）
SECRET_KEY=<32文字以上のランダム文字列>

# データベース
FIRSTLOOK_DB_PATH=/data/firstlook.db

# 永続パス設定
FIRSTLOOK_UPLOAD_DIR=/data/uploads
FIRSTLOOK_LOG_DIR=/data/logs

# API設定
GOOGLE_GEMINI_API_KEY=<あなたのGemini APIキー>

# アップロード設定
MAX_CONTENT_LENGTH=16777216

# セッション設定（本番環境）
SESSION_COOKIE_SECURE=True
REMEMBER_COOKIE_SECURE=True
```

### 4-2. SECRET_KEY の生成方法

**ローカルで実行:**
```bash
python -c 'import secrets; print(secrets.token_hex(32))'
```

**出力例:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

この文字列をコピーして `SECRET_KEY` に設定

### 4-3. 環境変数の追加手順

1. **Add Environment Variable** をクリック
2. **Key**: 例 `FLASK_ENV`
3. **Value**: 例 `production`
4. 上記の全ての変数を追加
5. **Save Changes** をクリック

---

## ステップ5: Persistent Disk 作成 💾

### 5-1. Disk追加

1. "Disks" タブをクリック
2. **Add Disk** ボタンをクリック

### 5-2. Disk設定

| 項目 | 設定値 |
|------|--------|
| **Name** | `firstlook-data` |
| **Mount Path** | `/data` |
| **Size** | `1 GB`（無料枠） |

### 5-3. 重要な注意点

- **Mount Path は必ず `/data`** にする
- 環境変数で設定したパスと一致させる:
  - `FIRSTLOOK_DB_PATH=/data/firstlook.db`
  - `FIRSTLOOK_UPLOAD_DIR=/data/uploads`
  - `FIRSTLOOK_LOG_DIR=/data/logs`

---

## ステップ6: プラン選択 💰

### 6-1. 推奨プラン

**Starter プラン: $7/月**
- 512MB RAM
- 常時起動（スリープなし）
- 十分なパフォーマンス
- **DAU 100人まで対応可能**

**Free プラン（非推奨）:**
- 15分間アクセスなしでスリープ
- 起動に30秒〜1分かかる
- ユーザー体験が悪い

### 6-2. プラン選択

1. "Instance Type" で **Starter** を選択
2. 月額料金が表示される: **$7/month**

---

## ステップ7: ヘルスチェック設定 🏥

### 7-1. Health Check Path

1. "Advanced" セクションを展開
2. **Health Check Path** に入力: `/healthz`

### 7-2. 動作確認

Renderは自動的に:
- 10秒ごとに `/healthz` にアクセス
- レスポンスが `200 OK` でない場合、再起動
- ログに記録

---

## ステップ8: デプロイ実行 🚀

### 8-1. 最終確認

**チェックリスト:**
- [x] Name: `firstlook-app`
- [x] Branch: `main`
- [x] Build Command: `pip install -r requirements.txt`
- [x] Start Command: 空欄（Procfile使用）
- [x] 環境変数: 10個すべて設定済み
- [x] Persistent Disk: `/data` マウント済み
- [x] Health Check: `/healthz` 設定済み
- [x] プラン: Starter ($7/月)

### 8-2. デプロイ開始

1. **Create Web Service** ボタンをクリック
2. ビルド・デプロイが自動開始

---

## ステップ9: デプロイ状況の確認 📊

### 9-1. ログの確認

**"Logs" タブで以下を確認:**

```
==> Cloning from https://github.com/your-username/FirstLook_app...
==> Downloading cache...
==> Running build command 'pip install -r requirements.txt'...
Successfully installed Flask-3.1.2 gunicorn-21.2.0 ...
==> Build successful 🎉
==> Starting service with 'gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120'...

[Config] 環境: production
[Config] DEBUG: False
[Config] DATABASE: /data/firstlook.db
[Config] UPLOAD_DIR: /data/uploads
[Config] LOG_DIR: /data/logs
====================================================
📁 永続パス初期化
====================================================
✅ DB ディレクトリ: /data
✅ Upload ディレクトリ: /data/uploads
✅ Log ディレクトリ: /data/logs
====================================================
🚀 FirstLook アプリケーション起動
====================================================

==> Your service is live 🎉
https://firstlook-app.onrender.com
```

### 9-2. エラーが出た場合

**よくあるエラーと対処法:**

| エラー | 原因 | 対処法 |
|--------|------|--------|
| `ModuleNotFoundError` | 依存パッケージ不足 | `requirements.txt` 確認 |
| `SECRET_KEY not set` | 環境変数未設定 | 環境変数を再確認 |
| `Permission denied` | Diskマウント失敗 | Mount Path を `/data` に修正 |
| `Port already in use` | 設定ミス | Start Command を空欄に |

---

## ステップ10: マイグレーション実行 🗄️

### 10-1. Shell でマイグレーション

1. Renderダッシュボード → あなたのサービス
2. 右上の **Shell** タブをクリック
3. 以下のコマンドを実行:

```bash
# マイグレーション状態確認
python scripts/migrate.py status

# マイグレーション実行
python scripts/migrate.py up

# 確認
python scripts/migrate.py status
```

**期待される出力:**
```
==> applying 0001_init.py
  ✅ 全14テーブル作成完了（外部キー制約準拠）
DONE
```

### 10-2. テーブル確認

```bash
# SQLiteに接続
sqlite3 /data/firstlook.db

# テーブル一覧
.tables

# 終了
.quit
```

---

## ステップ11: 動作確認 ✅

### 11-1. アプリにアクセス

**あなたのアプリURL:**
```
https://firstlook-app.onrender.com
```
（実際のURLはRenderダッシュボードで確認）

### 11-2. 確認項目

| 項目 | 確認方法 | 期待結果 |
|------|----------|----------|
| ホーム画面 | `/` にアクセス | ランディングページ表示 |
| ヘルスチェック | `/healthz` にアクセス | `{"status":"ok","database":"connected"}` |
| ユーザー登録 | `/auth/register` | 登録フォーム表示 |
| ログイン | `/auth/login` | ログインフォーム表示 |

### 11-3. 新規ユーザー登録テスト

1. `/auth/register` にアクセス
2. テストユーザーを作成:
   - Username: `testuser`
   - Email: `test@example.com`
   - Password: `Test1234!`
3. 登録成功 → ダッシュボードにリダイレクト
4. 画像アップロード（プロフィール画像）をテスト
5. 再起動後もデータが残っているか確認

---

## ステップ12: カスタムドメイン設定（オプション） 🌍

### 12-1. ドメイン追加

1. "Settings" タブ → "Custom Domain" セクション
2. **Add Custom Domain** をクリック
3. あなたのドメインを入力（例: `app.firstlook.jp`）

### 12-2. DNS設定

**あなたのドメインレジストラ（お名前.com、ムームードメイン等）で:**

| タイプ | ホスト名 | 値 |
|--------|---------|-----|
| CNAME | `app` | `firstlook-app.onrender.com` |

### 12-3. SSL証明書

- Renderが自動的にLet's Encrypt証明書を発行
- 数分で有効化
- 自動更新

---

## トラブルシューティング 🔧

### Q1: "Application failed to start"

**原因:**
- 環境変数の設定ミス
- Procfileの記述ミス

**対処法:**
```bash
# Logsタブで詳細確認
# 環境変数を再確認
# Start Command が空欄か確認
```

### Q2: "Database file not found"

**原因:**
- Persistent Diskが未マウント
- パスの設定ミス

**対処法:**
```bash
# Disksタブで /data マウント確認
# 環境変数 FIRSTLOOK_DB_PATH=/data/firstlook.db を確認
# Shellで確認: ls -la /data/
```

### Q3: 画像アップロード後に404エラー

**原因:**
- FIRSTLOOK_UPLOAD_DIR の設定ミス
- ディレクトリが自動作成されていない

**対処法:**
```bash
# Shellで確認
ls -la /data/uploads/

# 環境変数確認
echo $FIRSTLOOK_UPLOAD_DIR

# 再起動
# Renderダッシュボード → Manual Deploy → Deploy latest commit
```

### Q4: ヘルスチェック失敗

**原因:**
- `/healthz` エンドポイントが動作していない
- DBが壊れている

**対処法:**
```bash
# Logsで確認
# Shellでテスト: curl http://localhost:10000/healthz
# DBテスト: python -c "from db import db; db.connect(); print('OK')"
```

---

## 監視・運用 📈

### 自動監視

Renderが自動的に:
- ✅ ヘルスチェック（10秒ごと）
- ✅ アプリクラッシュ時の自動再起動
- ✅ SSL証明書の自動更新
- ✅ HTTPS強制リダイレクト

### 手動監視

**Metrics タブで確認:**
- CPU使用率
- メモリ使用率
- リクエスト数
- レスポンスタイム

**アラート設定（オプション）:**
- Slack連携
- Email通知
- Webhook

---

## バックアップ 💾

### データベースバックアップ

**手動バックアップ（推奨: 毎日）:**
```bash
# Render Shell で実行
cp /data/firstlook.db /data/firstlook.db.backup.$(date +%Y%m%d)

# ローカルにダウンロード
# Render Shell → cat コマンドでBase64エンコード → ローカルでデコード
```

**自動バックアップスクリプト（cron）:**
- Render の Cron Job 機能を使用
- または外部サービス（AWS S3, Google Cloud Storage）

### アップロード画像バックアップ

```bash
# 定期的に /data/uploads/ をバックアップ
# 推奨: 外部ストレージ（S3等）に同期
```

---

## コスト試算 💰

### 最小構成（Starter）

| 項目 | 料金 |
|------|------|
| Web Service (Starter) | $7/月 |
| Persistent Disk (1GB) | $0/月（無料） |
| **合計** | **$7/月** |

### 成長時（Standard）

| 項目 | 料金 |
|------|------|
| Web Service (Standard) | $25/月 |
| Persistent Disk (10GB) | $1/月 |
| **合計** | **$26/月** |

---

## 次のステップ 🎯

### 短期（今後1週間）

1. ✅ 本番環境でのユーザー登録・ログインテスト
2. ✅ 画像アップロード動作確認
3. ✅ AI肌診断機能テスト
4. ✅ パフォーマンス測定

### 中期（今後1ヶ月）

1. 📊 アクセス解析導入（Google Analytics）
2. 🔔 エラー監視（Sentry）
3. 📧 Email送信機能（SendGrid）
4. 🔍 SEO対策

### 長期（スケール時）

1. 🗄️ PostgreSQL移行
2. 🌍 CDN導入（CloudFlare）
3. 📦 Redis導入（セッション管理）
4. 🔄 複数インスタンス（水平スケール）

---

## 完了チェックリスト ✅

- [ ] runtime.txt 作成済み
- [ ] GitHub にプッシュ済み
- [ ] Renderアカウント作成済み
- [ ] Web Service作成済み
- [ ] 環境変数10個設定済み
- [ ] Persistent Disk作成済み（/data）
- [ ] ヘルスチェック設定済み（/healthz）
- [ ] デプロイ成功
- [ ] マイグレーション実行済み
- [ ] アプリ動作確認済み
- [ ] ユーザー登録テスト済み
- [ ] 画像アップロードテスト済み

---

## サポート情報 📞

### Render.com サポート

- ドキュメント: https://render.com/docs
- コミュニティ: https://community.render.com
- Status: https://status.render.com

### FirstLook アプリ

- GitHub Issues: あなたのリポジトリのIssuesタブ
- ローカルテスト: `python app.py`
- ヘルスチェック: `curl http://localhost:8000/healthz`

---

## まとめ

**この3ステップでアプリが公開されます:**

1. ✅ `runtime.txt` 作成（完了）
2. ⏳ GitHub プッシュ（次に実行）
3. ⏳ Render デプロイ（最後のステップ）

**デプロイ時間**: 約10-15分  
**初回起動後**: すぐにアクセス可能

**おめでとうございます！ 🎉**  
このガイドに従えば、FirstLookアプリを本番環境で公開できます。
