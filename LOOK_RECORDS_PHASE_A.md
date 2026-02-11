# Look Records Phase A 実装完了

## 概要

Future Face機能による見た目記録（自己改善記録）の保存・一覧表示機能を実装しました。
外部共有機能を持たない個人記録システムです。

## 実装内容

### 1. データベース

#### 新規モデル: `LookRecord`

ファイル: `models/look_record.py`

- `user_id` (FK): ユーザーID
- `date` (DATE): 記録日（YYYY-MM-DD）
- `photo_path` (VARCHAR): 保存画像パス
- `preset` (VARCHAR): Future Face効果タイプ（all/slim/skin/young）
- `strength` (INTEGER): 効果強度（0-100）
- `created_at` (TIMESTAMP): 作成日時

**制約:**
- UNIQUE(user_id, date): 1日1件のみ保存可能（上書き保存）

#### マイグレーション

ファイル: `migrations/0007_add_look_records.py`

```bash
python scripts/migrate.py up
```

### 2. バックエンドエンドポイント

ファイル: `routes/client.py`

#### 保存エンドポイント

**POST** `/client/api/look-records/save`

リクエスト:
```json
{
  "image_base64": "data:image/png;base64,...",
  "preset": "all",
  "strength": 40,
  "date": "2026-02-11"  // 省略可（省略時は今日）
}
```

レスポンス:
```json
{
  "ok": true,
  "record_id": 123,
  "date": "2026-02-11",
  "action": "created"  // or "updated"
}
```

**機能:**
- Base64画像をデコードしてPNG保存
- 保存先: `/data/records/<user_id>/<YYYY-MM>/<YYYY-MM-DD>.png`
- 同日の記録は上書き（upsert）

#### 一覧エンドポイント

**GET** `/client/look-records`

- ユーザーの記録を最新100件表示
- 日付降順ソート

### 3. フロントエンド

#### 保存ボタン（preview.html）

Future Faceパネル内に以下を追加:

1. **保存ボタン**
   - ラベル: "今日の記録として保存"
   - Future Face有効時のみ動作
   - 合成結果キャンバスをPNG化して保存

2. **記録一覧リンク**
   - ラベル: "記録一覧を見る"
   - `/client/look-records` へのリンク

#### 一覧ページ（templates/client/look_records.html）

- Bootstrap5のカードグリッドレイアウト
- 各記録に以下を表示:
  - 日付
  - サムネイル画像
  - 効果タイプ（プリセット）
  - 強度
  - 記録日時

## ディレクトリ構成

```
instance/uploads/look_records/
├── <user_id>/
│   ├── 2026-01/
│   │   ├── 2026-01-15.png
│   │   ├── 2026-01-20.png
│   │   └── ...
│   ├── 2026-02/
│   │   ├── 2026-02-01.png
│   │   └── ...
│   └── ...
```

## 動作確認手順

### 1. マイグレーション実行（完了）

```bash
source .venv/bin/activate
python scripts/migrate.py up
```

### 2. サーバー起動

```bash
python -m flask run --host=127.0.0.1 --port=8000
```

### 3. 動作確認

1. ログイン: `http://localhost:8000/login`
2. 成りたい顔選択: ダッシュボード → "成りたい顔を選ぶ"
3. Future Face有効化: プレビュー画面 → Future Face ON
4. 保存: "今日の記録として保存" ボタンをクリック
5. 一覧表示: "記録一覧を見る" リンクをクリック

## 技術仕様

### 画像保存

- フォーマット: PNG
- エンコーディング: Base64 → バイナリ
- サイズ: キャンバスサイズ（通常640x480）

### エラーハンドリング

- Base64デコード失敗 → 400エラー
- 日付フォーマット不正 → 400エラー
- サーバーエラー → 500エラー + ログ記録

### セキュリティ

- 認証必須（`@client_required`）
- 自分の記録のみ表示・保存可能
- ファイルパスはユーザーIDで分離

## Phase B 以降の拡張予定

- [ ] カレンダー表示
- [ ] スコア・コメント追加
- [ ] 記録の詳細表示・編集・削除
- [ ] グラフ表示（進捗確認）
- [ ] Before/After比較機能
- [ ] PDF/画像エクスポート

## 変更ファイル一覧

```
新規:
  models/look_record.py
  migrations/0007_add_look_records.py
  templates/client/look_records.html

変更:
  models/__init__.py
  routes/client.py
  templates/face_template/preview.html
```

## 実装日

2026-02-11

## ステータス

✅ Phase A 完了
