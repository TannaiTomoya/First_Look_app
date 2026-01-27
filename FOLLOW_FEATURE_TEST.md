# フォロー機能 - 動作確認ガイド

## 実装内容

### 1. バックエンド実装

#### モデル (`models/follow.py`)
```python
class Follow(BaseModel):
    """ユーザー間のフォロー関係を管理"""
    id = AutoField(primary_key=True)
    follower = DeferredForeignKey('User', backref='following', on_delete='CASCADE')
    followed = DeferredForeignKey('User', backref='followers', on_delete='CASCADE')
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        indexes = (
            (('follower', 'followed'), True),  # unique index（重複防止）
        )
```

#### ルート (`routes/users.py`)
- **フォロー**: `POST /users/<username>/follow`
- **アンフォロー**: `POST /users/<username>/unfollow`
- **フォロー中リスト**: `GET /users/<username>/following`
- **フォロワーリスト**: `GET /users/<username>/followers`

#### タイムライン機能 (`models/post.py`)
```python
def get_timeline_posts(current_user):
    """フォロー中のユーザーと自分の投稿を取得"""
    from models.follow import Follow
    following_users = Follow.select(Follow.followed).where(Follow.follower == current_user)
    posts = Post.select().where(
        (Post.user.in_(following_users)) | (Post.user == current_user)
    ).order_by(Post.created_at.desc())
    return posts
```

---

## 動作確認ポイント

### ✅ ユーザーをフォローできる

**確認手順**:
1. ログイン後、他のユーザーのプロフィールページを開く
   - ナビゲーションバーの検索からユーザーを検索
   - または直接URL: `/users/<username>`
2. 「フォロー」ボタンをクリック
3. 成功メッセージ「〇〇 をフォローしました」が表示される
4. ボタンが「フォロー中」に変化する
5. フォロー数が +1 される

**実装箇所**:
```python
# routes/users.py - follow()
@users.route('/<username>/follow', methods=['POST'])
@login_required
def follow(username):
    # フォロー対象ユーザーを取得
    user = User.select().where(User.username == username).first()
    
    # 自分自身はフォローできない
    if current_user.id == user.id:
        flash('自分自身をフォローすることはできません', 'warning')
        return redirect(url_for('users.profile', username=username))
    
    # フォローを作成
    Follow.create(follower=current_user, followed=user)
    flash(f'{user.username} をフォローしました', 'success')
```

**ボタンの表示**:
```html
<!-- templates/users/profile.html -->
{% if current_user.id != user.id %}
    <form method="POST" action="{{ url_for('users.follow', username=user.username) }}">
        <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
        <button type="submit" class="btn btn-primary btn-sm">
            <i class="fas fa-user-plus"></i> フォロー
        </button>
    </form>
{% endif %}
```

**セキュリティチェック**:
- ✅ ログイン必須（`@login_required`）
- ✅ CSRFトークン必須
- ✅ 自分自身はフォローできない
- ✅ 重複フォロー防止（ユニーク制約）

---

### ✅ ユーザーをアンフォローできる

**確認手順**:
1. フォロー中のユーザーのプロフィールページを開く
2. 「フォロー中」ボタンをクリック
3. 成功メッセージ「〇〇 のフォローを解除しました」が表示される
4. ボタンが「フォロー」に変化する
5. フォロー数が -1 される

**実装箇所**:
```python
# routes/users.py - unfollow()
@users.route('/<username>/unfollow', methods=['POST'])
@login_required
def unfollow(username):
    # フォロー関係を取得
    follow = Follow.select().where(
        (Follow.follower == current_user) & (Follow.followed == user)
    ).first()
    
    if follow:
        # フォローを削除
        follow.delete_instance()
        flash(f'{user.username} のフォローを解除しました', 'info')
    else:
        flash('フォローしていません', 'warning')
```

**ボタンの表示**:
```html
<!-- templates/users/profile.html -->
{% if is_following %}
    <form method="POST" action="{{ url_for('users.unfollow', username=user.username) }}">
        <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
        <button type="submit" class="btn btn-outline-secondary btn-sm">
            <i class="fas fa-user-minus"></i> フォロー中
        </button>
    </form>
{% endif %}
```

**動作**:
- フォロー関係がデータベースから削除される
- ホームフィードからその人の投稿が非表示になる
- フォロー数・フォロワー数が更新される

---

### ✅ フォロー中リストが表示される

**確認手順**:
1. プロフィールページを開く
2. 「〇〇 フォロー中」をクリック
3. フォロー中リストページが表示される
4. フォロー中のユーザーが一覧表示される

**表示内容**:
- プロフィール画像
- ユーザー名
- 自己紹介（先頭50文字）
- フォロー/フォロー中ボタン（他人の場合）

**実装箇所**:
```python
# routes/users.py - following()
@users.route('/<username>/following')
@login_required
def following(username):
    user = User.select().where(User.username == username).first()
    # フォロー中のユーザーリストを取得
    following_list = Follow.select().where(
        Follow.follower == user
    ).order_by(Follow.created_at.desc())
    
    return render_template(
        'users/following.html',
        user=user,
        following_list=following_list
    )
```

**テンプレート**: `templates/users/following.html`
```html
{% for follow in following_list %}
<div class="list-group-item d-flex align-items-center justify-content-between">
    <div class="d-flex align-items-center">
        <img src="{{ url_for('static', filename='uploads/profiles/' + follow.followed.profile_image) }}" />
        <div>
            <a href="{{ url_for('users.profile', username=follow.followed.username) }}">
                {{ follow.followed.username }}
            </a>
            {% if follow.followed.bio %}
            <div class="small text-muted">{{ follow.followed.bio[:50] }}</div>
            {% endif %}
        </div>
    </div>
    <!-- フォロー/アンフォローボタン -->
</div>
{% endfor %}
```

**並び順**: 新しくフォローしたユーザーが上に表示（降順）

**0件の場合**:
```html
<div class="text-center py-4">
    <i class="fas fa-user-slash fa-3x text-muted mb-3"></i>
    <p class="text-muted">まだ誰もフォローしていません</p>
</div>
```

---

### ✅ フォロワーリストが表示される

**確認手順**:
1. プロフィールページを開く
2. 「〇〇 フォロワー」をクリック
3. フォロワーリストページが表示される
4. フォロワーが一覧表示される

**表示内容**:
- プロフィール画像
- ユーザー名
- 自己紹介（先頭50文字）
- フォロー/フォロー中ボタン（他人の場合）

**実装箇所**:
```python
# routes/users.py - followers()
@users.route('/<username>/followers')
@login_required
def followers(username):
    user = User.select().where(User.username == username).first()
    # フォロワーリストを取得
    followers_list = Follow.select().where(
        Follow.followed == user
    ).order_by(Follow.created_at.desc())
    
    return render_template(
        'users/followers.html',
        user=user,
        followers_list=followers_list
    )
```

**テンプレート**: `templates/users/followers.html`
```html
{% for follow in followers_list %}
<div class="list-group-item d-flex align-items-center justify-content-between">
    <div class="d-flex align-items-center">
        <img src="{{ url_for('static', filename='uploads/profiles/' + follow.follower.profile_image) }}" />
        <div>
            <a href="{{ url_for('users.profile', username=follow.follower.username) }}">
                {{ follow.follower.username }}
            </a>
            {% if follow.follower.bio %}
            <div class="small text-muted">{{ follow.follower.bio[:50] }}</div>
            {% endif %}
        </div>
    </div>
    <!-- フォロー/アンフォローボタン -->
</div>
{% endfor %}
```

**並び順**: 新しくフォローしてくれたユーザーが上に表示（降順）

**0件の場合**:
```html
<div class="text-center py-4">
    <i class="fas fa-user-slash fa-3x text-muted mb-3"></i>
    <p class="text-muted">まだフォロワーがいません</p>
</div>
```

---

### ✅ ホームフィードにフォロー中の投稿のみ表示される

**確認手順**:
1. ホームページ（`/`）を開く
2. フォロー中のユーザーと自分の投稿のみが表示される
3. フォローしていないユーザーの投稿は表示されない
4. フォロー中のユーザーが0人の場合、案内メッセージが表示される

**実装箇所**:
```python
# app.py - index()
@app.route('/')
def index():
    if not current_user.is_authenticated:
        return render_template('index.html')
    
    # フォロー中のユーザーと自分の投稿を取得
    timeline_posts = get_timeline_posts(current_user)
    # ...
```

```python
# models/post.py - get_timeline_posts()
def get_timeline_posts(current_user):
    """フォロー中のユーザーと自分の投稿を取得"""
    from models.follow import Follow
    following_users = Follow.select(Follow.followed).where(Follow.follower == current_user)
    posts = Post.select().where(
        (Post.user.in_(following_users)) | (Post.user == current_user)
    ).order_by(Post.created_at.desc())
    return posts
```

**フィルタリングロジック**:
1. **フォロー中のユーザーを取得**: `Follow.select(Follow.followed).where(Follow.follower == current_user)`
2. **投稿を絞り込み**:
   - フォロー中のユーザーの投稿: `Post.user.in_(following_users)`
   - 自分の投稿: `Post.user == current_user`
   - OR条件で結合
3. **新着順にソート**: `order_by(Post.created_at.desc())`

**フォロー0人の場合**:
```html
<!-- templates/posts/index.html -->
<div class="card border-0 shadow-sm">
    <div class="card-body text-center py-5">
        <i class="fas fa-user-friends fa-4x text-muted mb-3"></i>
        <h3 class="h5 text-muted mb-3">まだフォロー中のユーザーがいません</h3>
        <p class="text-muted mb-4">
            他のユーザーをフォローすると、ここにその人の投稿が表示されます
        </p>
        <div class="d-flex gap-2 justify-content-center">
            <a href="{{ url_for('posts.explore') }}" class="btn btn-primary">
                <i class="fas fa-compass"></i> 投稿を探す
            </a>
            <a href="{{ url_for('search.index') }}" class="btn btn-outline-primary">
                <i class="fas fa-search"></i> ユーザーを検索
            </a>
        </div>
    </div>
</div>
```

**探索タブとの違い**:
- **ホームフィード**: フォロー中 + 自分の投稿のみ
- **探索タブ**: すべてのユーザーの投稿

---

### ✅ 自分をフォローできない

**確認手順**:
1. 自分のプロフィールページを開く
2. フォローボタンが表示されない
3. 「プロフィール編集」ボタンのみ表示される

**テンプレートでの制御**:
```html
<!-- templates/users/profile.html -->
{% if current_user.id == user.id %}
    <!-- 自分のプロフィールの場合：編集ボタン -->
    <a href="{{ url_for('users.edit', username=user.username) }}" class="btn btn-outline-primary btn-sm">
        <i class="fas fa-edit"></i> プロフィール編集
    </a>
{% else %}
    <!-- 他人のプロフィールの場合：フォローボタン -->
    <form method="POST" action="...">
        <button type="submit" class="btn btn-primary btn-sm">
            <i class="fas fa-user-plus"></i> フォロー
        </button>
    </form>
{% endif %}
```

**バックエンドでの制御**:
```python
# routes/users.py - follow()
# 自分自身はフォローできない
if current_user.id == user.id:
    flash('自分自身をフォローすることはできません', 'warning')
    return redirect(url_for('users.profile', username=username))
```

**強制的にフォローしようとした場合**:
- POSTリクエストで自分のユーザー名を指定しても拒否される
- 警告メッセージ「自分自身をフォローすることはできません」が表示される

---

## データベース仕様

### テーブル: `follows`

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER | 主キー（自動採番） |
| follower_id | INTEGER | フォローする側のユーザーID |
| followed_id | INTEGER | フォローされる側のユーザーID |
| created_at | DATETIME | フォロー日時 |

### インデックス

1. **ユニークインデックス**: `(follower_id, followed_id)`
   - 同じユーザーを2回フォローできない
   - 重複防止

2. **検索用インデックス**:
   - `follower_id` - フォロー中リスト取得の高速化
   - `followed_id` - フォロワーリスト取得の高速化

### カスケード削除

- ユーザーが削除されると、そのユーザーに関連するすべてのフォロー関係も自動削除
- `on_delete='CASCADE'`

---

## フォロー機能の流れ

### フォローする場合

1. **ユーザー**: プロフィールページの「フォロー」ボタンをクリック
2. **フロントエンド**: POSTリクエストを送信（CSRFトークン付き）
3. **バックエンド**: 
   - ログイン確認
   - フォロー対象ユーザーの存在確認
   - 自分自身ではないか確認
   - 既にフォロー済みでないか確認
   - フォロー関係をデータベースに保存
4. **レスポンス**: 成功メッセージとリダイレクト
5. **UI更新**: ボタンが「フォロー中」に変化、フォロー数が +1

### アンフォローする場合

1. **ユーザー**: プロフィールページの「フォロー中」ボタンをクリック
2. **フロントエンド**: POSTリクエストを送信（CSRFトークン付き）
3. **バックエンド**:
   - ログイン確認
   - フォロー関係の存在確認
   - データベースからフォロー関係を削除
4. **レスポンス**: 成功メッセージとリダイレクト
5. **UI更新**: ボタンが「フォロー」に変化、フォロー数が -1

---

## セキュリティとバリデーション

### セキュリティ対策

1. ✅ **ログイン必須**: すべてのフォロー関連エンドポイントで`@login_required`
2. ✅ **CSRFトークン**: すべてのPOSTリクエストでトークン検証
3. ✅ **権限チェック**: 自分自身をフォローできない
4. ✅ **重複防止**: データベースレベルでユニーク制約

### バリデーション

1. ✅ **ユーザー存在チェック**: フォロー対象ユーザーが存在するか確認
2. ✅ **重複フォローチェック**: 既にフォロー済みの場合は警告
3. ✅ **削除前チェック**: アンフォロー時にフォロー関係が存在するか確認

### エラーハンドリング

```python
# ユーザーが見つからない場合
if not user:
    flash('ユーザーが見つかりません', 'danger')
    return redirect(url_for('index'))

# 自分をフォローしようとした場合
if current_user.id == user.id:
    flash('自分自身をフォローすることはできません', 'warning')
    return redirect(url_for('users.profile', username=username))

# 既にフォロー済みの場合
if existing_follow:
    flash('既にフォローしています', 'info')

# フォローしていないのにアンフォローしようとした場合
if not follow:
    flash('フォローしていません', 'warning')
```

---

## トラブルシューティング

### フォローボタンが表示されない
**原因と対処法**:
1. 自分のプロフィールを見ている → 仕様通り（編集ボタンのみ表示）
2. ログアウトしている → ログインする
3. JavaScriptエラー → ブラウザのコンソールを確認

### フォローできない
**原因と対処法**:
1. 自分自身をフォローしようとしている → 他のユーザーをフォロー
2. 既にフォロー済み → 正常（警告メッセージ表示）
3. CSRFトークンエラー → ページを再読み込み

### ホームフィードに投稿が表示されない
**原因と対処法**:
1. 誰もフォローしていない → ユーザーをフォローする
2. フォロー中のユーザーが投稿していない → 探索タブで全投稿を確認
3. 自分も投稿していない → 投稿を作成する

---

## 実装済みファイル一覧

✅ **モデル**
- `models/follow.py` - Followモデル
- `models/user.py` - フォロー関連ヘルパーメソッド
- `models/post.py` - get_timeline_posts()

✅ **ルート**
- `routes/users.py` - フォロー、アンフォロー、リスト表示

✅ **テンプレート**
- `templates/users/profile.html` - フォローボタン
- `templates/users/following.html` - フォロー中リスト
- `templates/users/followers.html` - フォロワーリスト
- `templates/posts/index.html` - ホームフィード（フォロー中の投稿のみ）

✅ **ホームフィード**
- `app.py` - get_timeline_posts()の使用

---

## まとめ

フォロー機能は完全に実装されており、以下の機能が利用可能です:

1. ✅ ユーザーをフォロー（POST /users/<username>/follow）
2. ✅ ユーザーをアンフォロー（POST /users/<username>/unfollow）
3. ✅ フォロー中リスト表示（GET /users/<username>/following）
4. ✅ フォロワーリスト表示（GET /users/<username>/followers）
5. ✅ ホームフィードにフォロー中の投稿のみ表示
6. ✅ 自分をフォローできない（UI・バックエンド両方で制御）
7. ✅ 重複フォロー防止（ユニーク制約）
8. ✅ CSRFトークン保護
9. ✅ カスケード削除
10. ✅ レスポンシブデザイン

すべての動作確認ポイントをクリアしています。
