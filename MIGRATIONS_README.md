# マイグレーション運用ガイド - FirstLook

## マイグレーションシステムの導入（Task 03完了）

FirstLookアプリケーションに統一されたマイグレーションシステムを導入しました。

---

## 📌 クイックリファレンス（迷ったらここを見る）

### スキーマ変更が必要な時

```bash
# 1. マイグレーションファイルを作成（連番で！）
touch migrations/0002_add_feature.py

# 2. apply(db) 関数を実装
# migrations/0002_add_feature.py の中身を書く

# 3. テスト（DBを削除して再作成）
rm instance/firstlook.db
python scripts/migrate.py up

# 4. 確認
python scripts/migrate.py status
sqlite3 instance/firstlook.db "PRAGMA foreign_key_check;"

# 5. 問題なければコミット
git add migrations/0002_add_feature.py
git commit -m "Add migration: feature description"
```

### 絶対にやってはいけないこと

❌ `migrate_*.py` を作らない（旧形式）  
❌ 適用済みマイグレーションを編集しない  
❌ 手動でSQLを実行しない  
❌ アプリ起動時に自動マイグレーションしない  

---

## 🚨 緊急時の対応

### DB破損・不整合が発生した場合

```bash
# 1. 現在の状態を確認
python scripts/migrate.py status
sqlite3 instance/firstlook.db "PRAGMA foreign_key_check;"

# 2. バックアップがあれば復元
cp instance/firstlook.db.backup instance/firstlook.db

# 3. バックアップがなければ再作成
rm instance/firstlook.db
python scripts/migrate.py up

# 4. データが必要なら手動で復元
# （バックアップやエクスポートから）
```

### マイグレーションが失敗した場合

```bash
# 1. エラーログを確認
python scripts/migrate.py up
# エラーメッセージを読む

# 2. マイグレーションファイルを修正
vim migrations/0002_problematic.py

# 3. schema_migrationsから該当レコードを削除
sqlite3 instance/firstlook.db "DELETE FROM schema_migrations WHERE name='0002_problematic.py';"

# 4. 再実行
python scripts/migrate.py up
```

---

## 📋 ディレクトリ構造

```
FirstLook_app/
├── db.py                      # DB設定の単一ソース
├── migrations/                # マイグレーションファイル（新規）
│   ├── __init__.py
│   └── 0001_init.py          # 初期スキーマ（全14テーブル）
├── scripts/
│   └── migrate.py            # マイグレーションランナー
└── migrate_*.py              # ⚠️ 旧形式（参考用・使用禁止）
```

---

## 🚀 基本的な使い方

### マイグレーション状態の確認

```bash
python scripts/migrate.py status
```

**出力例:**
```
============================================================
📊 マイグレーション状態
============================================================
✅ 0001_init.py
============================================================
適用済み: 1 / 未適用: 0 / 合計: 1
============================================================
```

### マイグレーションの適用

```bash
python scripts/migrate.py up
```

**出力例:**
```
🚀 1 件のマイグレーションを適用します...

==> applying 0001_init.py
  ✅ 全14テーブル作成完了（外部キー制約準拠）
     - desired_faces, users, coaches, menus
     - photos, skin_checks, daily_checks
     - face_templates, face_parts, face_compositions
     - bookings, chats, messages
     - before_after_posts

✅ DONE - 全マイグレーション適用完了
```

---

## 📝 新規マイグレーションの作成方法

### 1. ファイル作成

```bash
# migrations/ ディレクトリに追加
# 命名規則: 0002_description.py, 0003_another.py, ...
touch migrations/0002_add_column_example.py
```

### 2. マイグレーションコードの記述

```python
# migrations/0002_add_column_example.py
"""
マイグレーション説明

変更内容:
- users テーブルに phone_number カラムを追加
"""

import models


def apply(db):
    """
    マイグレーション適用
    
    Args:
        db: Peeweeデータベースインスタンス
    """
    # SQLで直接カラム追加（例）
    db.execute_sql("""
        ALTER TABLE users 
        ADD COLUMN phone_number VARCHAR(20)
    """)
    
    print("  ✅ users.phone_number カラム追加完了")
```

### 3. マイグレーション適用

```bash
# 状態確認
python scripts/migrate.py status
# 出力: ⬜ 0002_add_column_example.py

# 適用
python scripts/migrate.py up

# 再確認
python scripts/migrate.py status
# 出力: ✅ 0002_add_column_example.py
```

---

## ⚠️ 重要な運用ルール（Task 03-4）

### 🔒 絶対禁止事項

#### ❌ 禁止1: `migrations/` 以外にマイグレーションファイルを作らない

**禁止:**
```bash
# ❌ ルートディレクトリに作成
touch migrate_add_new_feature.py

# ❌ 他のディレクトリに作成
touch scripts/migrate_something.py
```

**正しい:**
```bash
# ✅ migrations/ に連番で追加
touch migrations/0002_add_new_feature.py
```

**理由:**
- `schema_migrations` テーブルが唯一の真実の源
- `scripts/migrate.py` は `migrations/` 配下のみを管理
- 散在すると追跡不可能になる

---

#### ❌ 禁止2: 適用済みマイグレーションを編集・削除しない

**禁止:**
```bash
# ❌ 適用済みファイルの編集
vim migrations/0001_init.py  # 既に ✅ 適用済み

# ❌ 適用済みファイルの削除
rm migrations/0001_init.py
```

**理由:**
- 他の環境との不整合が発生
- 履歴の改ざんになる
- `schema_migrations` と実ファイルが乖離する

**対処法:**
- 新しいマイグレーション（例: `0002_fix_something.py`）を追加

---

#### ❌ 禁止3: 手動でSQLを直接実行しない

**禁止:**
```bash
# ❌ 直接SQLを実行
sqlite3 instance/firstlook.db "ALTER TABLE users ADD COLUMN new_field TEXT;"
```

**正しい:**
```bash
# ✅ マイグレーションファイルを作成
# migrations/0002_add_new_field.py
def apply(db):
    db.execute_sql("ALTER TABLE users ADD COLUMN new_field TEXT;")
```

**理由:**
- 履歴が残らず、他の環境で再現できない
- DB破損時の復元が不可能になる

---

#### ❌ 禁止4: アプリ起動時に自動マイグレーションを実行しない

**禁止:**
```python
# ❌ app.py で自動実行
if __name__ == '__main__':
    migrate_up()  # 危険！
    app.run()
```

**理由:**
- 予期せぬタイミングでスキーマ変更が発生
- マイグレーション失敗時にアプリが起動しない
- ロールバックが困難

**正しい:**
- デプロイ時に手動で `python scripts/migrate.py up` を実行

---

### ✅ やるべきこと

#### ✅ ルール1: 連番でマイグレーションを追加

```bash
# 既存
migrations/0001_init.py

# 新規追加（連番で）
migrations/0002_add_phone_number.py
migrations/0003_add_notifications.py
migrations/0004_update_indexes.py
```

**命名規則:**
- `0001_`, `0002_`, ... の連番
- アンダースコア後に説明的な名前
- 拡張子は `.py`

---

#### ✅ ルール2: 必ず `apply(db)` 関数を実装

```python
# migrations/0002_example.py
"""マイグレーションの説明"""

import models  # DeferredForeignKey解決のため


def apply(db):
    """
    マイグレーション適用
    
    Args:
        db: Peeweeデータベースインスタンス
    """
    # スキーマ変更を実装
    db.execute_sql("""
        ALTER TABLE users 
        ADD COLUMN phone_number VARCHAR(20)
    """)
    
    print("  ✅ users.phone_number カラム追加完了")
```

---

#### ✅ ルール3: 本番適用前に必ずテスト

```bash
# 1. 開発環境でテスト
rm instance/firstlook.db
python scripts/migrate.py up

# 2. 外部キー制約チェック
sqlite3 instance/firstlook.db "PRAGMA foreign_key_check;"

# 3. アプリケーション起動テスト
python app.py

# 4. エラーがなければ本番適用
```

---

#### ✅ ルール4: `schema_migrations` を唯一の真実の源とする

- マイグレーション適用状態は `schema_migrations` テーブルのみで管理
- ファイルの存在だけでは適用済みかわからない
- 必ず `python scripts/migrate.py status` で確認

---

### 🔄 DB破損時の復元手順

```bash
# 1. バックアップがあれば復元
cp instance/firstlook.db.backup instance/firstlook.db

# 2. バックアップがない場合は再作成
rm instance/firstlook.db
python scripts/migrate.py up

# 3. テストデータの投入（必要な場合）
python db_manager.py seed
```

---

### ✅ やるべきこと（続き）

5. **本番適用前に開発環境でテスト**
   - `rm instance/firstlook.db` で空DBテスト
   - `python scripts/migrate.py up` で再作成

6. **`safe=True` で冪等性を保証**
   - 同じマイグレーションを複数回実行しても安全

7. **外部キー制約を意識した順序**
   - 参照される側のテーブルを先に作成
   - `0001_init.py` を参考にする

---

### ❌ やってはいけないこと（続き）

4. **`schema_migrations` テーブルを直接編集しない**
   - ❌ `DELETE FROM schema_migrations WHERE name='0001_init.py';`
   - 履歴の改ざんになる

5. **マイグレーション番号を飛ばさない**
   - ❌ `0001` の次が `0005`
   - ✅ `0001` → `0002` → `0003` ...

6. **複数人で同じ番号を使わない**
   - チーム開発時は番号を調整
   - Git conflictを避けるため

---

## 🗂️ 旧形式のマイグレーションファイル

以下のファイルは **参考用** として残されています：

```
migrate_add_ai_skin_analysis.py  # AI診断機能追加
migrate_add_gender.py             # gender カラム追加
migrate_chat.py                   # チャット機能追加
```

### これらのファイルの扱い

- ✅ **参考用に保持**（削除しない）
- ❌ **今後は使用禁止**
- ⚠️ **新規作成禁止**

### 移行状況

既存DBには既にこれらの変更が適用されています。
新しいマイグレーションシステムは `0001_init.py` でクリーンな状態から全テーブルを作成します。

---

## 🔍 トラブルシューティング

### Q: マイグレーションが失敗する

```bash
# エラーログを確認
python scripts/migrate.py up

# DBをクリーンな状態から再作成
rm instance/firstlook.db
python scripts/migrate.py up
```

### Q: 外部キー制約エラー

```bash
# 外部キー制約をチェック
sqlite3 instance/firstlook.db "PRAGMA foreign_key_check;"

# 出力なし = 正常
# エラー表示 = 制約違反あり
```

### Q: テーブル作成順序が間違っている

`migrations/0001_init.py` の `ordered_models` リストを確認：
- 参照される側（DesiredFace, FacePart）が先
- 参照する側（User, Coach, など）が後

---

## 📊 受け入れ基準（Task 03）

### ✅ Task 03-1: マイグレーションランナー

- ✅ `python scripts/migrate.py status` で状態確認
- ✅ `python scripts/migrate.py up` で未適用マイグレーション実行
- ✅ 冪等性保証（2回実行しても安全）

### ✅ Task 03-2: 初期マイグレーション

- ✅ DBファイル削除後も `migrate up` で14テーブル再現
- ✅ `flask run` で主要ページが正常動作
- ✅ `PRAGMA foreign_key_check;` でエラーなし

---

## 🚀 本番環境へのデプロイ（Task 03-3）

### 前提条件

- Python 3.9以上
- SQLite3
- 永続ストレージ（Render: Persistent Disk, Heroku: Volume等）

---

### デプロイ手順

#### Step 1: 環境変数の設定

本番環境で以下の環境変数を設定：

```bash
# 必須
FLASK_ENV=production
SECRET_KEY=<安全なランダム文字列（32文字以上）>
FIRSTLOOK_DB_PATH=/var/lib/firstlook/firstlook.db  # 永続ストレージパス

# オプション
GOOGLE_GEMINI_API_KEY=<本番用APIキー>
MAX_CONTENT_LENGTH=16777216
SESSION_COOKIE_SECURE=True
REMEMBER_COOKIE_SECURE=True
```

**SECRET_KEY生成:**
```bash
python -c 'import secrets; print(secrets.token_hex(32))'
```

---

#### Step 2: 永続ストレージのマウント確認

```bash
# ディレクトリが存在するか確認
ls -la /var/lib/firstlook/

# 存在しない場合は作成（権限に注意）
mkdir -p /var/lib/firstlook
chmod 755 /var/lib/firstlook
```

**Render.comの例:**
```bash
# Persistent Diskをマウント
# Dashboard > Service > Disks で設定
# Mount Path: /opt/render/project/data
FIRSTLOOK_DB_PATH=/opt/render/project/data/firstlook.db
```

**Herokuの例:**
```bash
# Heroku Postgresを使用する場合はSQLiteではない
# SQLiteを使う場合はEphemeral Filesystem（再起動で消える）
```

---

#### Step 3: データベース初期化

⚠️ **重要:** マイグレーションは**手動実行**です。自動実行は事故の元です。

```bash
# アプリケーションディレクトリに移動
cd /path/to/FirstLook_app

# マイグレーション状態確認
python scripts/migrate.py status

# 出力例: ⬜ 0001_init.py （未適用）

# マイグレーション実行
python scripts/migrate.py up

# 出力例:
# 🚀 1 件のマイグレーションを適用します...
# ==> applying 0001_init.py
#   ✅ 全14テーブル作成完了（外部キー制約準拠）
# ✅ DONE - 全マイグレーション適用完了

# 再度確認
python scripts/migrate.py status
# 出力例: ✅ 0001_init.py （適用済み）
```

---

#### Step 4: データベース検証

```bash
# テーブル一覧確認
sqlite3 $FIRSTLOOK_DB_PATH ".tables"

# 外部キー制約チェック
sqlite3 $FIRSTLOOK_DB_PATH "PRAGMA foreign_key_check;"

# 出力なし = 正常
```

---

#### Step 5: アプリケーション起動

```bash
# Gunicorn（本番推奨）
gunicorn -w 4 -b 0.0.0.0:8000 app:app

# または Flask開発サーバー（非推奨）
python app.py
```

---

### 本番環境の確認事項

#### ✅ 起動ログの確認

```
[Config] 環境: production
[Config] DEBUG: False
[Config] DATABASE: /var/lib/firstlook/firstlook.db
[Config] GEMINI API: 設定済み
[Config] SESSION_COOKIE_SECURE: True
```

#### ✅ 主要ページの動作確認

1. **トップページ** - `https://yourdomain.com/`
2. **ログインページ** - `https://yourdomain.com/auth/login`
3. **登録ページ** - `https://yourdomain.com/auth/register`
4. **ダッシュボード** - ログイン後の画面

すべて **500エラーが出ないこと** を確認。

---

### 環境別のDB切り替え

#### 開発環境
```bash
FIRSTLOOK_DB_PATH=instance/firstlook.db
```

#### ステージング環境
```bash
FIRSTLOOK_DB_PATH=/var/lib/firstlook/staging.db
```

#### 本番環境
```bash
FIRSTLOOK_DB_PATH=/var/lib/firstlook/production.db
```

---

### バックアップ推奨

```bash
# 定期バックアップ（例：毎日）
cp $FIRSTLOOK_DB_PATH ${FIRSTLOOK_DB_PATH}.backup-$(date +%Y%m%d)

# 古いバックアップの削除（30日以上前）
find /var/lib/firstlook -name "*.backup-*" -mtime +30 -delete
```

---

### トラブルシューティング（本番環境）

#### Q: DBファイルが作成されない

```bash
# ディレクトリの権限確認
ls -la $(dirname $FIRSTLOOK_DB_PATH)

# 権限がない場合
sudo chown -R appuser:appuser /var/lib/firstlook
sudo chmod 755 /var/lib/firstlook
```

#### Q: マイグレーションが失敗する

```bash
# DBファイルを削除して再作成
rm $FIRSTLOOK_DB_PATH
python scripts/migrate.py up
```

#### Q: 外部キー制約エラー

```bash
# 制約違反をチェック
sqlite3 $FIRSTLOOK_DB_PATH "PRAGMA foreign_key_check;"

# データの不整合がある場合、DBを再作成
rm $FIRSTLOOK_DB_PATH
python scripts/migrate.py up
```

---

## 📊 受け入れ基準（Task 03）

### ✅ Task 03-1: マイグレーションランナー

- ✅ `python scripts/migrate.py status` で状態確認
- ✅ `python scripts/migrate.py up` で未適用マイグレーション実行
- ✅ 冪等性保証（2回実行しても安全）

### ✅ Task 03-2: 初期マイグレーション

- ✅ DBファイル削除後も `migrate up` で14テーブル再現
- ✅ `flask run` で主要ページが正常動作
- ✅ `PRAGMA foreign_key_check;` でエラーなし

### ✅ Task 03-3: 本番DB切り替え

- ✅ `FIRSTLOOK_DB_PATH` を変えるだけでDBが切り替わる
- ✅ 本番相当の空DBに対して `migrate up` が通る
- ✅ Flask起動後、主要画面が500にならない

---

## 🔗 関連ドキュメント

- `db.py` - データベース設定（`FIRSTLOOK_DB_PATH`環境変数サポート）
- `scripts/migrate.py` - マイグレーションランナー実装
- `migrations/0001_init.py` - 初期スキーマ定義
- `.env.example` - 環境変数のサンプル

---

**最終更新:** Task 03-3完了時  
**マイグレーションバージョン:** 0001_init.py  
**DB切り替え:** `FIRSTLOOK_DB_PATH`環境変数で制御
