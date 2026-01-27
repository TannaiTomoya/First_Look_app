# いいね機能 - 動作確認ガイド

## 実装内容

### 1. バックエンド
- **APIエンドポイント**: `/api/posts/<post_id>/like` (POST)
- **モデル**: `Like` (models/like.py)
- **機能**: いいねの追加・削除（トグル方式）
- **重複防止**: データベースレベルでユニーク制約

### 2. フロントエンド
- **JavaScript関数**: `toggleLike(postId)` (static/js/main.js)
- **Ajax通信**: fetch APIを使用
- **CSRF保護**: metaタグからトークン取得

### 3. 実装ページ
- ✅ ホームフィード (`templates/posts/index.html`)
- ✅ 探索ページ (`templates/posts/explore.html`)
- ✅ 投稿詳細 (`templates/posts/detail.html`)

---

## 動作確認ポイント

### ✅ いいねボタンをクリックするとハートアイコンが切り替わる
**確認方法**:
1. ログイン後、ホームフィード/探索/投稿詳細ページを開く
2. 投稿にマウスをホバー（グリッド表示）またはいいねボタンをクリック（詳細ページ）
3. ハートアイコンが空白→塗りつぶし（赤）に変化することを確認
4. 再度クリックして、塗りつぶし（赤）→空白に戻ることを確認

**期待される動作**:
- いいねしていない: `far fa-heart` (空白ハート)
- いいね済み: `fas fa-heart text-danger` (赤い塗りつぶしハート)

---

### ✅ いいね数がリアルタイムで更新される
**確認方法**:
1. いいねボタンをクリック
2. いいね数の表示が即座に +1 されることを確認
3. 再度クリックして -1 されることを確認

**実装箇所**:
```javascript
// いいね数の更新
const likeCount = document.querySelector(`#like-count-${postId}`);
if (likeCount) {
    likeCount.textContent = data.like_count;
}
```

---

### ✅ ページリロードなしで動作する（Ajax）
**確認方法**:
1. ブラウザの開発者ツール（Network タブ）を開く
2. いいねボタンをクリック
3. `/api/posts/<id>/like` へのPOSTリクエストが表示される
4. ページがリロードされないことを確認

**レスポンス例**:
```json
{
    "success": true,
    "liked": true,
    "like_count": 5
}
```

---

### ✅ 同じ投稿に2回いいねできない
**確認方法**:
1. 投稿にいいねする
2. データベースの `likes` テーブルを確認
3. 同じユーザー・投稿の組み合わせが1件のみ存在することを確認

**データベース制約**:
```python
class Meta:
    indexes = (
        (('user', 'post'), True),  # unique index
    )
```

---

### ✅ いいね済みをクリックすると削除される
**確認方法**:
1. いいね済みの投稿（赤いハート）を探す
2. ハートアイコンをクリック
3. ハートが空白に戻り、いいね数が -1 されることを確認
4. データベースから該当のいいねレコードが削除されることを確認

**実装ロジック**:
```python
if existing_like:
    # いいね済み → 削除
    existing_like.delete_instance()
    liked = False
else:
    # いいねしていない → 追加
    Like.create(user=current_user, post=post)
    liked = True
```

---

## トラブルシューティング

### CSRFトークンエラーが出る場合
- `base.html` に `<meta name="csrf-token">` タグが追加されているか確認
- `app.py` で `CSRFProtect` が初期化されているか確認

### いいねボタンが反応しない場合
- ブラウザのコンソールでJavaScriptエラーを確認
- `static/js/main.js` が正しく読み込まれているか確認
- ログインしているか確認（ログイン必須）

### いいね数が更新されない場合
- HTMLに `id="like-count-{{ post.id }}"` が設定されているか確認
- APIレスポンスに `like_count` が含まれているか確認

---

## 開発者向けメモ

### API仕様
- **URL**: `/api/posts/<int:post_id>/like`
- **メソッド**: POST
- **認証**: ログイン必須 (`@login_required`)
- **CSRFトークン**: 必須（ヘッダー: `X-CSRFToken`）

### JavaScript関数
```javascript
toggleLike(postId)  // いいねのトグル処理
getCSRFToken()      // CSRFトークンの取得
```

### データベーステーブル
- **テーブル名**: `likes`
- **カラム**: `id`, `user_id`, `post_id`, `created_at`
- **制約**: `(user_id, post_id)` のユニークインデックス
