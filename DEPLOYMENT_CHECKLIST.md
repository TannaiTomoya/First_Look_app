# デプロイ完了チェックリスト 🚀

## ✅ ステップ1: runtime.txt 作成 - 完了

**作成ファイル:**
- `runtime.txt` (Python 3.11指定)

**内容:**
```
python-3.11
```

---

## ✅ ステップ2: GitHub プッシュ - 完了

**コミット情報:**
- コミットハッシュ: `5a489dc`
- ブランチ: `main`
- リモート: `github.com:TannaiTomoya/First_Look_app.git`

**プッシュされたファイル:**
- ✅ `Procfile` (新規)
- ✅ `runtime.txt` (新規)
- ✅ `RENDER_DEPLOY_GUIDE.md` (新規)
- ✅ `routes/system.py` (新規)
- ✅ `requirements.txt` (更新)
- ✅ `config.py` (更新)
- ✅ `app.py` (更新)
- ✅ `.env.example` (更新)
- ✅ `README.md` (更新)
- ✅ `utils/uploads.py` (更新)

---

## ⏳ ステップ3: Render.com デプロイ - 次のステップ

### 📋 実行手順

**完全ガイド:** `RENDER_DEPLOY_GUIDE.md` を参照

### クイックスタート（5分）

#### 1. Render.com アカウント作成
```
https://render.com
→ "Sign up with GitHub" でサインアップ
```

#### 2. Web Service 作成
```
Dashboard → "New +" → "Web Service"
→ GitHubリポジトリ選択: "First_Look_app"
→ "Connect"
```

#### 3. 基本設定
| 項目 | 設定値 |
|------|--------|
| Name | `firstlook-app` |
| Region | `Singapore` |
| Branch | `main` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | **空欄**（Procfile使用） |

#### 4. 環境変数設定（11個）

**重要な環境変数:**
```bash
FLASK_ENV=production
SECRET_KEY=<32文字以上のランダム文字列>
GOOGLE_GEMINI_API_KEY=<あなたのAPIキー>
FIRSTLOOK_DB_PATH=/data/firstlook.db
FIRSTLOOK_UPLOAD_DIR=/data/uploads
FIRSTLOOK_EXPORT_DIR=/data/exports
FIRSTLOOK_LOG_DIR=/data/logs
SESSION_COOKIE_SECURE=True
REMEMBER_COOKIE_SECURE=True
MAX_CONTENT_LENGTH=16777216
```

**SECRET_KEY 生成:**
```bash
python -c 'import secrets; print(secrets.token_hex(32))'
```

#### 5. Persistent Disk 作成
```
"Disks" タブ → "Add Disk"
Name: firstlook-data
Mount Path: /data
Size: 1GB
```

#### 6. ヘルスチェック設定
```
"Advanced" → "Health Check Path"
値: /healthz
```

#### 7. プラン選択
```
"Starter" ($7/月) を選択
```

#### 8. デプロイ実行
```
"Create Web Service" をクリック
→ 自動ビルド・デプロイ開始（約5-10分）
```

#### 9. マイグレーション実行
```
Render Dashboard → あなたのサービス → "Shell" タブ

# 実行コマンド
python scripts/migrate.py up
```

#### 10. 動作確認
```
あなたのアプリURL: https://firstlook-app.onrender.com

確認項目:
✓ ホーム画面 (/)
✓ ヘルスチェック (/healthz)
✓ ユーザー登録 (/auth/register)
✓ ログイン (/auth/login)
```

---

## 📊 現在の状態

### ✅ 完了済み

| タスク | ステータス | 完了日時 |
|--------|----------|----------|
| runtime.txt 作成 | ✅ 完了 | 2026-02-06 |
| Procfile 作成 | ✅ 完了 | 2026-02-06 |
| 環境変数対応実装 | ✅ 完了 | 2026-02-06 |
| ヘルスチェック実装 | ✅ 完了 | 2026-02-06 |
| 永続ストレージ対応 | ✅ 完了 | 2026-02-06 |
| GitHub プッシュ | ✅ 完了 | 2026-02-06 |
| デプロイガイド作成 | ✅ 完了 | 2026-02-06 |

### ⏳ 次のステップ

| タスク | ステータス | 所要時間 |
|--------|----------|----------|
| Render アカウント作成 | ⏳ 待機中 | 1分 |
| Web Service 作成 | ⏳ 待機中 | 2分 |
| 環境変数設定 | ⏳ 待機中 | 3分 |
| Persistent Disk 作成 | ⏳ 待機中 | 1分 |
| デプロイ実行 | ⏳ 待機中 | 5-10分 |
| マイグレーション実行 | ⏳ 待機中 | 1分 |
| 動作確認 | ⏳ 待機中 | 5分 |

**合計所要時間**: 約15-20分

---

## 🎯 成功の確認方法

### デプロイ成功時のログ

```
==> Build successful 🎉
==> Starting service with 'gunicorn app:app ...'

[Config] 環境: production
[Config] DEBUG: False
[Config] DATABASE: /data/firstlook.db
====================================================
📁 永続パス初期化
====================================================
✅ DB ディレクトリ: /data
✅ Upload ディレクトリ: /data/uploads
✅ Export ディレクトリ: /data/exports
✅ Log ディレクトリ: /data/logs
====================================================
🚀 FirstLook アプリケーション起動
====================================================

==> Your service is live 🎉
https://firstlook-app.onrender.com
```

### ヘルスチェック成功

```bash
$ curl https://firstlook-app.onrender.com/healthz

{"status":"ok","database":"connected"}
```

### ホーム画面表示

```
ブラウザで https://firstlook-app.onrender.com にアクセス
→ FirstLook ランディングページが表示される
```

---

## ⚠️ よくある問題と対処法

### 問題1: "Application failed to start"

**原因:**
- 環境変数の設定ミス
- Start Command が設定されている（空欄にすべき）

**対処法:**
1. Renderダッシュボード → Settings
2. "Start Command" を確認 → **空欄にする**
3. 環境変数を再確認
4. Manual Deploy → "Deploy latest commit"

### 問題2: "Module not found"

**原因:**
- `requirements.txt` にパッケージが不足

**対処法:**
1. `requirements.txt` に `gunicorn==21.2.0` があるか確認
2. GitHub にプッシュし直し
3. Render で再デプロイ

### 問題3: ヘルスチェック失敗

**原因:**
- `/healthz` エンドポイントが動作していない
- DBに接続できない

**対処法:**
1. Logs タブでエラー確認
2. Persistent Disk が `/data` にマウントされているか確認
3. 環境変数 `FIRSTLOOK_DB_PATH=/data/firstlook.db` を確認

---

## 📞 サポート情報

### Render.com

- **ドキュメント**: https://render.com/docs
- **コミュニティ**: https://community.render.com
- **Status**: https://status.render.com

### あなたのリポジトリ

- **GitHub**: https://github.com/TannaiTomoya/First_Look_app
- **最新コミット**: `5a489dc`

---

## 🎉 おめでとうございます！

**あと一歩でアプリが公開されます！**

次のステップ:
1. Render.com にアクセス
2. `RENDER_DEPLOY_GUIDE.md` に従ってデプロイ
3. 15-20分後にアプリが公開される

**頑張ってください！ 🚀**
