# FirstLook データベーススキーマ再設計計画

## 問題点

### Instagram風アプリ（PhotoShare）の名残
以下の要素がFirstLookアプリに不適切な形で残存：

1. **データベース名**: `photoapp.db` → `firstlook.db` に変更すべき
2. **不要なテーブル**:
   - `posts` - SNS風の通常投稿（FirstLookには不要）
   - `comments` - コメント機能（FirstLookには不要）
   - `likes` - いいね機能（FirstLookには不要）
   - `follows` - フォロー機能（FirstLookには不要）

3. **不要なモデルファイル**: `models/post.py` の Post クラス
4. **不要なルートファイル**: `routes/posts.py`
5. **不要なフォームファイル**: `forms/post_forms.py`
6. **不要なテンプレート**: `templates/posts/` の一部

## 正しいスキーマ設計

### FirstLookに必要なテーブル（11テーブル）

#### 1. ユーザー管理
- **users** - ユーザー情報、ロール（client/coach）、選択中の印象カード

#### 2. コーチ関連
- **coaches** - コーチプロフィール（User拡張）
- **menus** - コーチが提供するメニュー

#### 3. 印象・診断
- **desired_faces** - なりたい印象カード
- **skin_checks** - 肌診断記録

#### 4. 予約・コミュニケーション
- **bookings** - 予約情報
- **chats** - 1対1チャットルーム（予約に紐付く）
- **messages** - チャットメッセージ

#### 5. チェック・記録
- **daily_checks** - 当日5分チェック
- **photos** - 画像ファイル管理（汎用）
- **before_after_posts** - Before/After投稿（FirstLook専用）

### Before/After投稿の正しい設計

```
BeforeAfterPost モデル:
- user_id (投稿者)
- before_photo_id (施術前写真 → Photoテーブル)
- after_photo_id (施術後写真 → Photoテーブル)
- caption (キャプション)
- desired_face_id (目指した印象カード、任意)
- created_at

Photo モデル:
- user_id (アップロード者)
- purpose (用途: before/after/coach_profile/daily_check)
- file_path (ファイルパス)
- created_at
```

**Instagram風の Post との違い**:
- `Post`: 単一画像の通常投稿（SNS機能）
- `BeforeAfterPost`: Before/After の2枚組み比較投稿（FirstLook専用機能）

## 実施する変更

### Phase 1: クリーンアップ（不要なファイル削除）
1. `models/post.py` から Post クラスを削除（ファイルは削除）
2. `routes/posts.py` を削除
3. `forms/post_forms.py` を削除
4. `templates/posts/` の不要なテンプレート削除
   - 保持: なし（Before/Afterは別ディレクトリ）
   - 削除: create.html, detail.html, explore.html, index.html

### Phase 2: データベース名変更
1. `models/__init__.py`: `photoapp.db` → `firstlook.db`
2. `README.md`: データベース名の更新

### Phase 3: 不要なモデルの削除
1. `models/__init__.py` から Post のインポート削除
2. comments, likes, follows モデルが存在する場合は削除

### Phase 4: Blueprint の整理
1. `app.py` から posts Blueprint の登録を削除

### Phase 5: データベース再構築
1. 既存のデータベースを削除
2. 新しいスキーマでテーブル作成
3. テストデータ再投入

## 期待される結果

✅ FirstLook専用の11テーブル構成
✅ Instagram風機能の完全削除
✅ Before/After投稿機能の独立性確保
✅ データベース名の適切な命名
✅ クリーンなコードベース

## Before/After機能の転用状況

### ✅ 正しく転用された部分
- `BeforeAfterPost` モデル: Instagram風の単純投稿とは別に設計
- `Photo` モデル: 汎用的な画像管理
- `routes/before_after.py`: 専用ルート実装
- `templates/before_after/`: 専用テンプレート


