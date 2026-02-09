# Render.com デプロイ手順書

## ✅ 事前準備完了

以下のファイルが正しく配置されています：
- ✅ `Procfile` - Gunicorn起動設定
- ✅ `requirements.txt` - Python依存パッケージ
- ✅ `runtime.txt` - Python 3.11指定
- ✅ `.gitignore` - `.env`除外済み

---

## 🚀 デプロイ手順

### ステップ1: SECRET_KEY生成

ローカルで実行：

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

出力された64文字の文字列をメモ（例: `a1b2c3d4...`）

---

### ステップ2: Render Web Service作成

1. [Render Dashboard](https://dashboard.render.com/) にアクセス
2. **New +** → **Web Service** をクリック
3. **Connect GitHub repository**
   - リポジトリを選択
   - Branch: `main`
4. 基本設定
   - **Name**: `firstlook` (任意)
   - **Region**: `Singapore` または `Oregon`（推奨）
   - **Build Command**: 空欄（自動で `pip install -r requirements.txt`）
   - **Start Command**: 空欄（Procfileを自動適用）

---

### ステップ3: Persistent Disk追加

**重要**: SQLiteとアップロード画像を永続化するため必須

1. サービス画面で **Disks** タブをクリック
2. **Add Disk** をクリック
3. 設定：
   - **Name**: `firstlook-data`
   - **Mount Path**: `/data`
   - **Size**: `1 GB`（最小。必要に応じて増量可能）

---

### ステップ4: 環境変数設定

**Environment Variables** タブで以下を追加：

#### 必須の環境変数（9個）

| 変数名 | 値 | 説明 |
|--------|-----|------|
| `FLASK_ENV` | `production` | 本番環境モード |
| `SECRET_KEY` | `<ステップ1で生成した64文字>` | セッション暗号化キー |
| `GOOGLE_GEMINI_API_KEY` | `AIza...` | Gemini APIキー |
| `FIRSTLOOK_DB_PATH` | `/data/firstlook.db` | SQLiteデータベースパス |
| `FIRSTLOOK_UPLOAD_DIR` | `/data/uploads` | アップロード画像保存先 |
| `FIRSTLOOK_EXPORT_DIR` | `/data/exports` | **⚠️ 必須** Export画像保存先 |
| `FIRSTLOOK_LOG_DIR` | `/data/logs` | ログファイル保存先 |
| `SESSION_COOKIE_SECURE` | `True` | HTTPS必須化 |
| `REMEMBER_COOKIE_SECURE` | `True` | Remember Me Cookie保護 |

#### 設定方法

```bash
# コピペ用（値は書き換えてください）
FLASK_ENV=production
SECRET_KEY=<ステップ1で生成した値>
GOOGLE_GEMINI_API_KEY=<Gemini APIキー>
FIRSTLOOK_DB_PATH=/data/firstlook.db
FIRSTLOOK_UPLOAD_DIR=/data/uploads
FIRSTLOOK_EXPORT_DIR=/data/exports
FIRSTLOOK_LOG_DIR=/data/logs
SESSION_COOKIE_SECURE=True
REMEMBER_COOKIE_SECURE=True
```

---

### ステップ5: Health Check設定（推奨）

**Settings** → **Health Check Path**:
```
/healthz
```

これにより、Renderがサービスの稼働状況を自動監視します。

---

### ステップ6: デプロイ実行

1. **Manual Deploy** → **Deploy latest commit** をクリック
2. ビルドログを確認
3. `==> Build successful 🎉` が表示されるまで待機（約3-5分）
4. `==> Your service is live 🎉` が表示されたら次へ

---

### ステップ7: 初回DB作成（超重要）

⚠️ **この手順をスキップするとアプリが起動しません**

1. Render Dashboard → サービス画面 → **Shell** タブをクリック
2. 以下のコマンドを順番に実行：

```bash
# 1. 環境変数確認
export FIRSTLOOK_DB_PATH=/data/firstlook.db
echo $FIRSTLOOK_DB_PATH

# 2. マイグレーション実行
python scripts/migrate.py up

# 3. seedデータ投入
python db_manager.py seed
```

#### 実行結果の確認

```bash
# DBファイルの存在確認
ls -lh /data/firstlook.db

# seedデータ確認
python check_seed_data.py
```

**期待される出力:**
```
✅ seedデータ投入完了！公開可能です
眉パーツ: 4件 ✓ OK
鼻パーツ: 3件 ✓ OK
```

---

### ステップ8: 動作確認

#### 8-1. アクセス確認

Renderが提供するURL（例: `https://firstlook.onrender.com`）にアクセス

⚠️ **必ず `https://` でアクセスしてください**
- `http://` でアクセスすると、Cookie設定でログイン維持が壊れます

#### 8-2. 基本機能テスト

| URL | 確認項目 | チェック |
|-----|----------|----------|
| `/` | トップページ表示 | ☐ |
| `/terms` | 利用規約表示 | ☐ |
| `/privacy` | プライバシーポリシー表示 | ☐ |
| `/healthz` | `{"status":"ok"}` 返却 | ☐ |
| `/register` | 新規登録画面 | ☐ |
| `/login` | ログイン画面 | ☐ |

#### 8-3. 登録フロー確認

1. `/register` で新規登録
   - ✅ 18歳以上チェックボックスが表示される
   - ✅ 利用規約同意チェックボックスが表示される
   - ✅ 両方チェックしないと登録ボタンが押せない
2. ログイン
3. `/client/dashboard` にリダイレクト
4. `/client/daily-check` で170個のランダムヒントが表示される

#### 8-4. 核心機能テスト

1. 印象カード選択
2. 顔テンプレート選択
3. 眉パーツ選択（4種類から選択可能）
4. 鼻パーツ選択（3種類から選択可能）
5. プレビュー生成
6. **Export実行**
7. **Share URL取得**
8. Share URLにアクセスして画像表示確認

---

## 🔍 トラブルシューティング

### 問題1: 500 Internal Server Error

**原因**: DB未作成またはExport/Logディレクトリの環境変数未設定

**解決策**:
```bash
# Render Shellで実行
python scripts/migrate.py up
python db_manager.py seed
```

### 問題2: ログインできない / セッションが保持されない

**原因**: `http://` でアクセスしている

**解決策**: 必ず `https://` でアクセスしてください

### 問題3: Export機能が動かない

**原因**: `FIRSTLOOK_EXPORT_DIR` が未設定

**解決策**:
```bash
# 環境変数に追加
FIRSTLOOK_EXPORT_DIR=/data/exports
```

### 問題4: 画像がアップロードできない

**原因**: `FIRSTLOOK_UPLOAD_DIR` が未設定またはPersistent Disk未マウント

**解決策**:
1. Persistent Diskが `/data` にマウントされているか確認
2. 環境変数を確認：
```bash
FIRSTLOOK_UPLOAD_DIR=/data/uploads
```

### 問題5: Health Check Failed

**原因**: `/healthz` エンドポイントが実装されていない、または起動に失敗

**解決策**:
```bash
# ローカルで確認
curl https://your-app.onrender.com/healthz

# 期待される出力
{"status":"ok"}
```

---

## 📊 デプロイ後の確認事項

### 必須確認

- ☐ Health Checkが緑（Healthy）になっている
- ☐ すべてのページが表示される
- ☐ ユーザー登録ができる
- ☐ ログインが維持される
- ☐ Export機能が動作する
- ☐ Share URLで画像が表示される

### セキュリティ確認

- ☐ HTTPS強制が有効（HTTP→HTTPSリダイレクト）
- ☐ 環境変数に`.env`の内容がコピーされていない
- ☐ SECRET_KEYがランダム生成されている（`.env`と同じ値を使用していない）
- ☐ GOOGLE_GEMINI_API_KEYが本番用に再発行されている

---

## 🎯 次のステップ（任意）

### 推奨設定

1. **カスタムドメイン設定**
   - Render Settings → Custom Domains
   - 独自ドメインを設定（例: `firstlook.example.com`）

2. **Google Analytics追加**
   - `templates/base.html` にGAタグ追加

3. **OG画像設定**
   - SNSシェア用の画像を設定

### 監視・運用

1. **Render Logs確認**
   - エラーログの定期チェック

2. **Disk使用量監視**
   - `/data` の容量確認（1GB超えたら増量）

3. **バックアップ**
   - `/data/firstlook.db` の定期バックアップ（手動または自動化）

---

## 📝 重要な注意事項

### Persistent Disk について

- Renderの無料プランでは**1つのDiskのみ**利用可能
- Diskを削除すると**すべてのデータが失われます**
- サービスを削除してもDiskは残る（明示的に削除が必要）

### 環境変数について

- 環境変数を変更したら**必ず再デプロイ**が必要
- SECRET_KEYを変更すると**全ユーザーのセッションが無効化**されます

### コスト

- 無料プランの制限：
  - サービスが750時間/月以上動作すると自動停止
  - 15分間アクセスがないとスリープ（次回アクセス時に起動）
  - Persistent Disk 1GB無料

---

## ✅ デプロイ完了チェックリスト

最終確認：

- ☐ Persistent Disk（/data）が設定されている
- ☐ 環境変数9個すべて設定されている
- ☐ Health Checkパス（/healthz）が設定されている
- ☐ デプロイが成功している（Build successful）
- ☐ migrate up が実行されている
- ☐ seed データが投入されている
- ☐ https:// でアクセスできる
- ☐ 新規登録ができる
- ☐ ログインが維持される
- ☐ Export機能が動作する
- ☐ Share URLで画像が表示される

すべてチェックが完了したら、**FirstLookの公開完了です！** 🎉

---

## 📞 サポート

問題が発生した場合：
1. Render Logsを確認
2. `/healthz` エンドポイントの動作確認
3. 環境変数の再確認
4. Persistent Diskのマウント確認

以上
