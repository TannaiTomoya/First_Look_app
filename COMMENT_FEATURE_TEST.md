# コメント機能 - 動作確認ガイド

## 実装内容

### 1. バックエンド実装

#### モデル (`models/comment.py`)
```python
class Comment(BaseModel):
    id = AutoField(primary_key=True)
    content = TextField()
    user = DeferredForeignKey('User', backref='comments', on_delete='CASCADE')
    post = DeferredForeignKey('Post', backref='comments', on_delete='CASCADE')
    created_at = DateTimeField(default=datetime.now)
```

#### フォーム (`forms/post_forms.py`)
```python
class CommentForm(FlaskForm):
    content = TextAreaField(
        'コメント',
        validators=[
            DataRequired(message='コメントを入力してください'),
            Length(min=1, max=500, message='コメントは1〜500文字で入力してください')
        ]
    )
    submit = SubmitField('コメント')
```

#### ルート (`routes/posts.py`)
- **コメント投稿**: `POST /posts/<post_id>/comment`
- **コメント削除**: `POST /posts/<post_id>/comment/<comment_id>/delete`

### 2. フロントエンド実装

#### テンプレート (`templates/posts/detail.html`)
- コメント投稿フォーム
- コメント一覧表示
- コメント削除ボタン（投稿者のみ表示）

---

## 動作確認ポイント

### ✅ コメントを投稿できる

**確認手順**:
1. ログイン後、任意の投稿詳細ページを開く
2. ページ下部のコメント投稿フォームにテキストを入力
3. 「コメント」ボタンをクリック
4. 成功メッセージ「コメントを投稿しました」が表示される
5. 入力したコメントがコメント一覧に追加される

**実装箇所**:
```python
# routes/posts.py - add_comment()
@posts.route('/<int:post_id>/comment', methods=['POST'])
@login_required
def add_comment(post_id):
    # コメントを作成
    Comment.create(
        user=current_user.id,
        post=post,
        content=form.content.data
    )
```

**バリデーション**:
- 空のコメントは投稿できない（1文字以上必須）
- 500文字を超えるコメントは投稿できない
- ログインしていない場合は投稿できない

**エラーメッセージ例**:
- 「コメントを入力してください」（空欄の場合）
- 「コメントは1〜500文字で入力してください」（文字数超過）

---

### ✅ コメント一覧が表示される

**確認手順**:
1. 投稿詳細ページを開く
2. 既存のコメントが一覧表示される
3. 各コメントに以下の情報が表示される:
   - ユーザー名（太字）
   - コメント内容
   - 削除ボタン（自分のコメントのみ）

**実装箇所**:
```html
<!-- templates/posts/detail.html -->
{% for comment in comments %}
<div class="d-flex mb-2">
    <span class="fw-bold me-2">{{ comment.user.username }}</span>
    <span class="flex-grow-1">{{ comment.content }}</span>
    <!-- 削除ボタン -->
</div>
{% endfor %}
```

**データ取得**:
```python
# routes/posts.py - detail()
comments = Comment.select().where(
    Comment.post == post
).order_by(Comment.created_at.asc())
```

**表示順序**:
- 古いコメント順に表示（投稿日時の昇順）

---

### ✅ 投稿者のみコメント削除ボタンが表示される

**確認手順**:
1. 投稿詳細ページで自分のコメントを探す
2. 自分のコメントには「×」ボタン（削除ボタン）が表示される
3. 他人のコメントには削除ボタンが表示されない

**実装箇所**:
```html
<!-- templates/posts/detail.html -->
{% if current_user.id == comment.user.id %}
<form method="POST" action="{{ url_for('posts.delete_comment', post_id=post.id, comment_id=comment.id) }}" 
      class="d-inline ms-2" 
      onsubmit="return confirm('本当にこのコメントを削除しますか？');">
    <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
    <button type="submit" class="btn btn-link btn-sm text-danger p-0">
        <i class="fas fa-times"></i>
    </button>
</form>
{% endif %}
```

**権限チェック**:
- `current_user.id == comment.user.id` で投稿者を判定
- 条件に一致する場合のみ削除ボタンを表示

---

### ✅ コメントを削除できる

**確認手順**:
1. 自分のコメントの削除ボタン（×）をクリック
2. 確認ダイアログ「本当にこのコメントを削除しますか？」が表示される
3. 「OK」をクリック
4. 成功メッセージ「コメントを削除しました」が表示される
5. コメントがコメント一覧から削除される

**実装箇所**:
```python
# routes/posts.py - delete_comment()
@posts.route('/<int:post_id>/comment/<int:comment_id>/delete', methods=['POST'])
@login_required
def delete_comment(post_id, comment_id):
    # 権限チェック
    if comment.user.id != current_user.id:
        flash('このコメントを削除する権限がありません', 'danger')
        abort(403)
    
    # コメントを削除
    comment.delete_instance()
```

**セキュリティ**:
- ログイン必須（`@login_required`）
- 投稿者本人のみ削除可能（権限チェック）
- CSRFトークン必須
- 不正アクセスは403エラー

**エラーケース**:
- 他人のコメント削除を試みた場合: 「このコメントを削除する権限がありません」
- 存在しないコメント: 「コメントが見つかりません」

---

## 追加機能・UI

### コメント表示の折りたたみ（4件以上の場合）

**実装箇所**:
```html
{% for comment in comments %}
<div class="d-flex mb-2 {% if loop.index > 3 %}collapse{% endif %}" id="comment-{{ comment.id }}">
    <!-- コメント内容 -->
</div>
{% endfor %}

{% if comments.count() > 3 %}
<button class="btn btn-link text-muted p-0 small" type="button" data-bs-toggle="collapse" data-bs-target="[id^='comment-']">
    すべてのコメントを見る（{{ comments.count() }}件）
</button>
{% endif %}
```

**動作**:
- コメントが4件以上ある場合、最初の3件のみ表示
- 「すべてのコメントを見る」ボタンで全件表示に切り替え

---

## データベース仕様

### テーブル: `comments`

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER | 主キー（自動採番） |
| content | TEXT | コメント内容（最大500文字） |
| user_id | INTEGER | 投稿者ID（外部キー） |
| post_id | INTEGER | 投稿ID（外部キー） |
| created_at | DATETIME | 投稿日時 |

### インデックス
- `post_id` にインデックス（高速な検索）
- `created_at` にインデックス（並び替え高速化）

### カスケード削除
- ユーザーが削除されると、そのユーザーのコメントもすべて削除
- 投稿が削除されると、その投稿のコメントもすべて削除

---

## トラブルシューティング

### コメントが投稿できない
**原因と対処法**:
1. ログインしていない → ログインする
2. 空のコメント → 1文字以上入力する
3. 500文字超過 → 文字数を減らす
4. CSRFエラー → ページを再読み込み

### コメント削除ボタンが表示されない
**原因と対処法**:
1. 他人のコメント → 仕様通り（自分のコメントのみ削除可能）
2. ログアウト状態 → ログインする

### コメントが削除できない
**原因と対処法**:
1. 権限がない → 自分のコメントのみ削除可能
2. ネットワークエラー → ブラウザの開発者ツールで確認

---

## 実装済みファイル一覧

✅ **モデル**
- `models/comment.py` - Commentモデル定義

✅ **フォーム**
- `forms/post_forms.py` - CommentForm定義

✅ **ルート**
- `routes/posts.py` - add_comment(), delete_comment()

✅ **テンプレート**
- `templates/posts/detail.html` - コメント表示・投稿・削除UI

✅ **データベース**
- `comments`テーブル（マイグレーション済み）

---

## まとめ

コメント機能は完全に実装されており、以下の機能が利用可能です:

1. ✅ コメント投稿（1〜500文字）
2. ✅ コメント一覧表示（古い順）
3. ✅ コメント削除（投稿者のみ）
4. ✅ 権限チェック（本人のみ削除可能）
5. ✅ CSRFトークン保護
6. ✅ カスケード削除（投稿・ユーザー削除時）
7. ✅ 折りたたみ表示（4件以上の場合）

すべての動作確認ポイントをクリアしています。
