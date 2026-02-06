# FirstLook - 第一印象コンサルティングプラットフォーム

失敗できない場面（商談・面接・婚活）の前に、第一印象を整えるためのマッチングプラットフォーム

## セットアップ

### 1. 仮想環境の有効化
```bash
source .venv/bin/activate
```

### 2. 依存関係のインストール
```bash
pip install -r requirements.txt
```

### 3. データベースのセットアップ

**推奨方法（マイグレーションシステム使用）:**
```bash
# マイグレーション状態確認
python scripts/migrate.py status

# マイグレーション適用
python scripts/migrate.py up

# テストデータ投入（任意）
python db_manager.py seed

# テーブル確認
python scripts/migrate.py status
```

**旧方法（参考用）:**
```bash
# ⚠️ 非推奨：今後は migrate.py を使用してください
python db_manager.py create
```

**詳細:** マイグレーション運用の詳細は `MIGRATIONS_README.md` を参照

### 4. 環境変数の設定

`.env.example` をコピーして `.env` ファイルを作成し、必要な環境変数を設定：

```bash
cp .env.example .env
```

**必須設定項目:**
- `SECRET_KEY`: セッション暗号化キー（本番環境では必ず変更）
- `GOOGLE_GEMINI_API_KEY`: AI肌診断用APIキー
- `FLASK_ENV`: 環境（development / production）

### 5. アプリケーションの起動

## ⚠️ 重要: flask run は使用禁止

本番環境では **必ず Gunicorn を使用** してください。

**❌ 使用禁止:**
```bash
flask run
```

**理由:**
- `flask run` は開発専用サーバー
- マルチプロセス非対応（スケーラビリティなし）
- セキュリティリスク（本番環境での使用は非推奨）
- パフォーマンスが低い

---

**✅ 正しい起動方法:**

**開発環境（推奨）:**
```bash
python app.py
```

**本番環境（Gunicorn使用）:**
```bash
gunicorn app:app \
  --bind 0.0.0.0:$PORT \
  --workers 2 \
  --threads 4 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
```

**PaaS環境（Render/Heroku/Railway）:**

`Procfile` が自動的に使用されます：
```
web: gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120
```

**設定の根拠:**
- Flask + 画像処理 + Gemini API → 同期I/Oが多い
- `workers 2` `threads 4` が現実的なバランス
- `timeout 120` で画像解析の待ち時間に対応
- ログは標準出力へ（コンテナ・クラウド対応）

**ヘルスチェック:**
```bash
curl http://localhost:$PORT/healthz
# または
curl http://localhost:$PORT/health
```

**正常時のレスポンス:**
```json
{
  "status": "ok",
  "database": "connected"
}
```

ブラウザで http://localhost:8000 にアクセス

**起動確認:**
- アプリケーションが正常に起動
- データベース接続が初期化
- ホーム画面が表示される

## プロジェクト構成

```
FirstLook_app/
├── app.py                 # Flaskアプリケーションのエントリーポイント
├── Procfile              # PaaS用起動設定（Render/Heroku/Railway）
├── config.py             # 環境別設定（Dev/Prod/Test）
├── db.py                 # データベース設定
├── models/               # データベースモデル（PeeWee）
│   ├── user.py           # ユーザーモデル
│   ├── coach.py          # コーチ・メニューモデル
│   ├── impression.py     # 印象カード・肌診断モデル
│   ├── booking.py        # 予約モデル
│   ├── chat.py           # チャット・メッセージモデル
│   └── daily_check.py    # 当日チェック・Before/After投稿モデル
├── routes/               # ルート定義
│   ├── auth.py           # 認証
│   ├── client.py         # クライアント機能
│   ├── coach.py          # コーチ管理
│   ├── booking.py        # 予約
│   ├── chat.py           # チャット
│   ├── before_after.py   # Before/After投稿
│   ├── users.py          # ユーザープロフィール
│   └── system.py         # システムエンドポイント（ヘルスチェック）
├── forms/                # WTForms
├── templates/            # HTMLテンプレート
├── static/               # 静的ファイル
│   └── uploads/          # アップロード画像
│       ├── profiles/     # プロフィール画像
│       ├── posts/        # 投稿画像
│       └── before_after/ # Before/After画像
├── utils/                # ユーティリティ
│   ├── image_handler.py  # 画像処理
│   ├── uploads.py        # 画像アップロード処理
│   ├── logging_helper.py # ログ設定
│   └── gemini_skin_analysis.py # AI肌診断
├── migrations/           # データベースマイグレーション
│   ├── __init__.py
│   └── 0001_init.py      # 初回スキーマ作成
├── scripts/              # 管理スクリプト
│   └── migrate.py        # マイグレーションランナー
├── instance/             # データベースファイル
│   └── firstlook.db      # SQLiteデータベース
├── .env                  # 環境変数（Git除外）
├── .env.example          # 環境変数テンプレート
├── db_manager.py         # データベース管理スクリプト（旧）
├── requirements.txt      # Python依存関係
├── requirements.md       # 要件定義書
├── features.md           # 機能一覧
├── routes.md            # ルーティング設計
├── screens.md           # 画面一覧
├── user_stories.md      # ユーザーストーリー
└── MIGRATIONS_README.md # マイグレーション運用ガイド
```

## MVP機能（最小実装）

1. 認証・アカウント管理
2. Coach検索・選択
3. 予約機能
4. 1対1チャット
5. 当日コンテンツ配信

## データベース管理コマンド

```bash
# ヘルプ表示
python db_manager.py help

# テーブル作成
python db_manager.py create

# テーブル削除（確認プロンプトあり）
python db_manager.py drop

# テーブルリセット（確認プロンプトあり）
python db_manager.py reset

# テーブル一覧とレコード数表示
python db_manager.py show

# テストデータ投入
python db_manager.py seed

# データベース詳細情報（統計・最新投稿など）
python db_manager.py info
```

## データベーススキーマ（FirstLook専用）

### 11テーブル構成

1. **users** - ユーザー情報（role, desired_face含む）
2. **coaches** - コーチプロフィール
3. **menus** - コーチのメニュー
4. **desired_faces** - 印象カード
5. **skin_checks** - 肌診断
6. **bookings** - 予約情報
7. **chats** - 1対1チャットルーム
8. **messages** - チャットメッセージ
9. **daily_checks** - 当日5分チェック
10. **photos** - 画像ファイル管理（汎用）
11. **before_after_posts** - Before/After投稿

詳細は `DATABASE_REDESIGN_COMPLETE.md` を参照

## 技術スタック

- **Backend**: Flask 3.1.2
- **ORM**: PeeWee 3.19.0
- **認証**: Flask-Login 0.6.3
- **Database**: SQLite（開発環境）
- **Production Server**: Gunicorn 21.2.0
- **Template Engine**: Jinja2
- **Port**: 8000（開発）/ PORT環境変数（本番）

## 本番環境デプロイ

### 事前準備

1. **環境変数の設定**

本番環境で以下の環境変数を設定：

```bash
export FLASK_ENV=production
export SECRET_KEY="your-production-secret-key-min-32-chars"
export GOOGLE_GEMINI_API_KEY="your-gemini-api-key"

# 永続パス設定（デプロイ先に応じて変更）
export FIRSTLOOK_DB_PATH="/var/lib/firstlook/firstlook.db"
export FIRSTLOOK_UPLOAD_DIR="/var/lib/firstlook/uploads"
export FIRSTLOOK_LOG_DIR="/var/log/firstlook"

export PORT=8080  # クラウドプロバイダーが指定するポート
export SESSION_COOKIE_SECURE=True
export REMEMBER_COOKIE_SECURE=True
```

**重要:**
- `SECRET_KEY` は32文字以上のランダム文字列を使用
- 開発用のキー（`dev-secret-key-change-in-production`等）は本番では起動できないよう保護されています

**永続パス設定例（デプロイ先別）:**

| デプロイ先 | DB | Upload | Log |
|-----------|-----|---------|-----|
| VPS/自前 | `/var/lib/firstlook/firstlook.db` | `/var/lib/firstlook/uploads` | `/var/log/firstlook` |
| Render.com | `/data/firstlook.db` | `/data/uploads` | `/data/logs` |
| Fly.io | `/data/firstlook.db` | `/data/uploads` | `/data/logs` |
| Railway | `/data/firstlook.db` | `/data/uploads` | `/data/logs` |

2. **永続ストレージの準備**

**VPS/自前サーバー:**
```bash
# ディレクトリ作成
sudo mkdir -p /var/lib/firstlook/uploads
sudo mkdir -p /var/log/firstlook

# 権限設定
sudo chown -R app-user:app-user /var/lib/firstlook
sudo chown -R app-user:app-user /var/log/firstlook
```

**Render.com:**
- Persistent Disk を作成（例: `/data`）
- マウントパス: `/data`
- ディレクトリは自動作成される（app.py で `makedirs`）

**Fly.io:**
- Volume を作成
  ```bash
  fly volumes create firstlook_data --size 10
  ```
- `fly.toml` でマウント設定
  ```toml
  [mounts]
    source = "firstlook_data"
    destination = "/data"
  ```

**Railway:**
- Volume をプロジェクトに追加
- マウントパス: `/data`

3. **データベースの初期化**

本番DBディレクトリを作成し、マイグレーションを実行：

```bash
# 環境変数が設定されていることを確認
echo $FIRSTLOOK_DB_PATH
echo $FIRSTLOOK_UPLOAD_DIR
echo $FIRSTLOOK_LOG_DIR

# マイグレーション適用
python scripts/migrate.py up

# テーブル確認
python scripts/migrate.py status
```

4. **依存関係のインストール**

```bash
pip install -r requirements.txt
```

### 起動

**Gunicornで起動:**

```bash
gunicorn app:app \
  --bind 0.0.0.0:$PORT \
  --workers 2 \
  --threads 4 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
```

**systemdサービスとして起動（Linux）:**

`/etc/systemd/system/firstlook.service` を作成：

```ini
[Unit]
Description=FirstLook Application
After=network.target

[Service]
Type=notify
User=www-data
WorkingDirectory=/opt/firstlook
Environment="FLASK_ENV=production"
Environment="PORT=8080"
EnvironmentFile=/opt/firstlook/.env.production
ExecStart=/opt/firstlook/.venv/bin/gunicorn app:app \
  --bind 0.0.0.0:8080 \
  --workers 2 \
  --threads 4 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
Restart=always

[Install]
WantedBy=multi-user.target
```

起動：

```bash
sudo systemctl enable firstlook
sudo systemctl start firstlook
sudo systemctl status firstlook
```

### ヘルスチェック

アプリケーションの健全性を確認：

```bash
curl http://localhost:$PORT/health
```

**正常時のレスポンス:**
```json
{
  "status": "healthy",
  "database": "connected",
  "environment": "production"
}
```

### ロードバランサー・オーケストレーション設定

**Docker/Kubernetes:**
```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
```

**Nginx（リバースプロキシ）:**
```nginx
upstream firstlook {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://firstlook;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://firstlook;
        access_log off;
    }
}
```

### トラブルシューティング

**起動時エラー:**
- `SECRET_KEY` が開発用の値のままではないか確認
- `FIRSTLOOK_DB_PATH` のディレクトリが存在し、書き込み権限があるか確認
- `FIRSTLOOK_UPLOAD_DIR` のディレクトリが存在し、書き込み権限があるか確認
- マイグレーションが適用済みか確認（`python scripts/migrate.py status`）

**ヘルスチェック失敗:**
- データベースファイルの権限を確認
- ログを確認（`--error-logfile` の出力）
- DB接続テスト：`python -c "from db import db; db.connect(); print('OK')"`

**画像アップロードエラー:**
- `FIRSTLOOK_UPLOAD_DIR` のパーミッションを確認
- ディスク容量を確認
- ログで詳細なエラーメッセージを確認

**再起動後にデータが消える:**
- 永続ストレージが正しくマウントされているか確認
- 環境変数 `FIRSTLOOK_DB_PATH`, `FIRSTLOOK_UPLOAD_DIR` が永続パスを指しているか確認
- PaaSの場合、Persistent Disk/Volume が有効か確認

---

## データ永続化の注意事項

### SQLiteの運用制限

**現在の構成（MVP）:**
- データベース: SQLite
- 推奨: **1インスタンス運用のみ**
- 同時書き込み: 限定的（WALモードでも制約あり）

**SQLiteが適している場合:**
- DAU（デイリーアクティブユーザー）100人以下
- 単一インスタンス運用
- 低〜中トラフィック

**PostgreSQLへの移行を検討すべき場合:**
- DAU 100人超え
- 複数インスタンスが必要（水平スケール）
- 高トラフィック
- 同時書き込みが頻繁

### 永続パスの管理

**開発環境:**
```bash
FIRSTLOOK_DB_PATH=instance/firstlook.db
FIRSTLOOK_UPLOAD_DIR=instance/uploads
FIRSTLOOK_LOG_DIR=instance/logs
```

**本番環境（VPS）:**
```bash
FIRSTLOOK_DB_PATH=/var/lib/firstlook/firstlook.db
FIRSTLOOK_UPLOAD_DIR=/var/lib/firstlook/uploads
FIRSTLOOK_LOG_DIR=/var/log/firstlook
```

**本番環境（PaaS）:**
```bash
FIRSTLOOK_DB_PATH=/data/firstlook.db
FIRSTLOOK_UPLOAD_DIR=/data/uploads
FIRSTLOOK_LOG_DIR=/data/logs
```

**重要:**
- 環境変数を変更するだけでパス切り替え可能
- コード変更は不要
- ディレクトリは自動作成される（`app.py` で `makedirs`）

### バックアップ推奨

**SQLiteデータベース:**
```bash
# 定期バックアップ（cron）
0 3 * * * cp $FIRSTLOOK_DB_PATH $FIRSTLOOK_DB_PATH.backup.$(date +\%Y\%m\%d)
```

**アップロード画像:**
```bash
# rsync で定期バックアップ
0 4 * * * rsync -av $FIRSTLOOK_UPLOAD_DIR/ /backup/uploads/
```
