# プロフィール機能 - 動作確認ガイド

## 実装内容

### 1. バックエンド実装

#### モデル拡張 (`models/user.py`)
```python
def post_count(self):
    """投稿数を取得"""
    return self.posts.count()

def following_count(self):
    """フォロー中の数を取得"""
    return Follow.select().where(Follow.follower == self).count()

def followers_count(self):
    """フォロワー数を取得"""
    return Follow.select().where(Follow.followed == self).count()

def is_following(self, user):
    """指定ユーザーをフォロー中かチェック"""
    return Follow.select().where(
        (Follow.follower == self) & (Follow.followed == user)
    ).exists()
```

#### フォーム (`forms/profile_forms.py`)
```python
class ProfileEditForm(FlaskForm):
    username = StringField('ユーザー名', validators=[...])
    bio = TextAreaField('自己紹介', validators=[...])
    profile_image = FileField('プロフィール画像', validators=[...])
    submit = SubmitField('保存')
```

#### ルート (`routes/users.py`)
- **プロフィール表示**: `GET /users/<username>`
- **プロフィール編集**: `GET/POST /users/<username>/edit`
- **フォロー**: `POST /users/<username>/follow`
- **アンフォロー**: `POST /users/<username>/unfollow`
- **フォロー中リスト**: `GET /users/<username>/following`
- **フォロワーリスト**: `GET /users/<username>/followers`

### 2. フロントエンド実装

#### テンプレート
- `templates/users/profile.html` - プロフィール表示
- `templates/users/edit.html` - プロフィール編集
- `templates/users/following.html` - フォロー中リスト
- `templates/users/followers.html` - フォロワーリスト

---

## 動作確認ポイント

### ✅ プロフィールページが表示される

**確認手順**:
1. ログイン後、ナビゲーションバーのユーザー名をクリック
2. 「プロフィール」を選択
3. プロフィールページが表示される

**表示内容**:
- プロフィール画像（円形、150x150px）
- ユーザー名
- 統計情報（投稿数、フォロワー数、フォロー中の数）
- 自己紹介文
- 投稿一覧（グリッド表示）
- プロフィール編集ボタン（自分のプロフィールの場合）
- フォローボタン（他人のプロフィールの場合）

**実装箇所**:
```python
# routes/users.py - profile()
@users.route('/<username>')
@login_required
def profile(username):
    user = User.select().where(User.username == username).first()
    posts = Post.select().where(Post.user == user).order_by(Post.created_at.desc())
    # 統計情報を取得
    post_count = user.post_count()
    following_count = user.following_count()
    followers_count = user.followers_count()
    # ...
```

**URL例**:
- 自分のプロフィール: `/users/myusername`
- 他人のプロフィール: `/users/otherusername`

---

### ✅ 投稿数、フォロー数、フォロワー数が表示される

**確認手順**:
1. プロフィールページを開く
2. ヘッダー部分に統計情報が表示される
3. 数値が正確に表示される

**表示形式**:
```
10 投稿  |  25 フォロワー  |  30 フォロー中
```

**実装箇所**:
```html
<!-- templates/users/profile.html -->
<div class="d-flex gap-4 mb-3">
    <div>
        <span class="fw-bold">{{ post_count }}</span>
        <span class="text-muted">投稿</span>
    </div>
    <div>
        <span class="fw-bold">{{ followers_count }}</span>
        <span class="text-muted">フォロワー</span>
    </div>
    <div>
        <span class="fw-bold">{{ following_count }}</span>
        <span class="text-muted">フォロー中</span>
    </div>
</div>
```

**カウント方法**:
- **投稿数**: `user.posts.count()`
- **フォロワー数**: `Follow.select().where(Follow.followed == user).count()`
- **フォロー中**: `Follow.select().where(Follow.follower == user).count()`

---

### ✅ プロフィール編集ができる

**確認手順**:
1. 自分のプロフィールページを開く
2. 「プロフィール編集」ボタンをクリック
3. 編集ページが表示される
4. ユーザー名、自己紹介を編集
5. 「保存」ボタンをクリック
6. 成功メッセージ「プロフィールを更新しました」が表示される
7. プロフィールページに戻り、変更が反映される

**編集可能項目**:
- ユーザー名（3〜50文字、重複不可）
- 自己紹介（最大500文字）
- プロフィール画像（JPEG/PNG/GIF）

**実装箇所**:
```python
# routes/users.py - edit()
@users.route('/<username>/edit', methods=['GET', 'POST'])
@login_required
def edit(username):
    # 自分のプロフィールのみ編集可能
    if current_user.username != username:
        abort(403)
    
    form = ProfileEditForm()
    if form.validate_on_submit():
        current_user.username = form.username.data
        current_user.bio = form.bio.data
        if form.profile_image.data:
            image_filename = save_image(form.profile_image.data, image_type='profile')
            current_user.profile_image = image_filename
        current_user.save()
        # ...
```

**バリデーション**:
- ユーザー名の重複チェック（自分以外）
- 文字数制限チェック
- 画像形式チェック

**セキュリティ**:
- 本人のみ編集可能（他人のプロフィールは403エラー）
- CSRFトークン必須

---

### ✅ プロフィール画像をアップロードできる

**確認手順**:
1. プロフィール編集ページを開く
2. 「プロフィール画像」の「ファイルを選択」をクリック
3. JPEG/PNG/GIF形式の画像を選択
4. 画像プレビューが即座に表示される
5. 「保存」ボタンをクリック
6. 画像がアップロードされる
7. プロフィールページで新しい画像が表示される

**画像処理**:
- **サイズ**: 200x200pxに自動リサイズ（正方形）
- **形式**: JPEG/PNG/GIF対応
- **ファイル名**: UUID生成で重複回避
- **保存先**: `static/uploads/profiles/`

**実装箇所**:
```javascript
// templates/users/edit.html - プレビュー機能
document.getElementById('profile-image-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profile-preview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});
```

**画像処理ロジック**:
```python
# utils/image_handler.py - save_image()
def save_image(file, image_type='profile', maintain_aspect=False):
    # プロフィール画像は200x200pxの正方形にリサイズ
    if image_type == 'profile':
        max_size = PROFILE_IMAGE_SIZE  # (200, 200)
        maintain_aspect = False  # 正方形に切り抜き
    # ...
```

**エラーハンドリング**:
- 許可されていない形式: 「許可されていないファイル形式です」
- ファイルサイズ超過: 「ファイルサイズが大きすぎます」

---

### ✅ 自分の投稿一覧が表示される

**確認手順**:
1. プロフィールページを開く
2. 投稿一覧がグリッド表示される
3. 投稿をクリックすると詳細ページに遷移
4. 投稿がない場合は「まだ投稿がありません」と表示される

**表示形式**:
- グリッドレイアウト（3列）
- 投稿画像（正方形、アスペクト比1:1）
- ホバーでいいね数・コメント数を表示

**実装箇所**:
```python
# routes/users.py - profile()
posts = Post.select().where(Post.user == user).order_by(Post.created_at.desc())
```

```html
<!-- templates/users/profile.html -->
<div class="row g-3">
    {% for post in posts %}
    <div class="col-6 col-md-4">
        <a href="{{ url_for('posts.detail', post_id=post.id) }}">
            <div class="photo-grid-item">
                <img src="{{ url_for('static', filename=post.image_file) }}" />
                <div class="photo-grid-overlay">
                    <i class="fas fa-heart"></i> {{ post.like_count() }}
                    <i class="fas fa-comment"></i> {{ post.comments.count() }}
                </div>
            </div>
        </a>
    </div>
    {% endfor %}
</div>
```

**投稿がない場合**:
```html
<div class="text-center py-5">
    <i class="fas fa-camera fa-4x text-muted mb-3"></i>
    <h3 class="h5 text-muted">まだ投稿がありません</h3>
    {% if current_user.id == user.id %}
    <a href="{{ url_for('posts.create') }}" class="btn btn-primary">
        投稿を作成
    </a>
    {% endif %}
</div>
```

---

## 追加機能

### 1. フォロー機能

**フォローボタン**:
- 他人のプロフィール表示時に「フォロー」ボタンが表示
- フォロー済みの場合は「フォロー中」ボタンに変化
- ボタンクリックでフォロー/アンフォローをトグル

**実装**:
```python
# routes/users.py - follow()
@users.route('/<username>/follow', methods=['POST'])
@login_required
def follow(username):
    user = User.select().where(User.username == username).first()
    # 自分自身はフォローできない
    if current_user.id == user.id:
        flash('自分自身をフォローすることはできません', 'warning')
        return redirect(url_for('users.profile', username=username))
    # フォローを作成
    Follow.create(follower=current_user, followed=user)
    # ...
```

### 2. フォロー中リスト

**URL**: `/users/<username>/following`

**表示内容**:
- フォロー中のユーザー一覧
- 各ユーザーのプロフィール画像、ユーザー名、自己紹介
- フォロー/アンフォローボタン

### 3. フォロワーリスト

**URL**: `/users/<username>/followers`

**表示内容**:
- フォロワー一覧
- 各ユーザーのプロフィール画像、ユーザー名、自己紹介
- フォロー/アンフォローボタン

---

## データベース仕様

### テーブル: `users`

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER | 主キー |
| username | VARCHAR(50) | ユーザー名（ユニーク） |
| email | VARCHAR(120) | メールアドレス（ユニーク） |
| password_hash | VARCHAR(255) | パスワードハッシュ |
| profile_image | VARCHAR(255) | プロフィール画像ファイル名 |
| bio | TEXT | 自己紹介 |
| created_at | DATETIME | 登録日時 |

### テーブル: `follows`

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER | 主キー |
| follower_id | INTEGER | フォローする側のユーザーID |
| followed_id | INTEGER | フォローされる側のユーザーID |
| created_at | DATETIME | フォロー日時 |

**制約**:
- `(follower_id, followed_id)` のユニーク制約（重複フォロー防止）

---

## トラブルシューティング

### プロフィール画像が表示されない
**原因と対処法**:
1. `static/uploads/profiles/` ディレクトリが存在しない → 自動作成される
2. デフォルト画像が設定されていない → `default.jpg` を配置
3. 画像のパスが間違っている → `onerror` ハンドラでプレースホルダー表示

### プロフィール編集ができない
**原因と対処法**:
1. 他人のプロフィールを編集しようとしている → 403エラー（仕様通り）
2. ユーザー名が重複している → エラーメッセージ表示
3. CSRFトークンエラー → ページを再読み込み

### 統計情報が0になる
**原因と対処法**:
1. まだ投稿/フォローがない → 正常（仕様通り）
2. データベースの関連付けエラー → モデル定義を確認

---

## 実装済みファイル一覧

✅ **モデル**
- `models/user.py` - Userモデル拡張（統計メソッド追加）
- `models/follow.py` - Followモデル（既存）

✅ **フォーム**
- `forms/profile_forms.py` - ProfileEditForm

✅ **ルート**
- `routes/users.py` - プロフィール、編集、フォロー機能

✅ **テンプレート**
- `templates/users/profile.html` - プロフィール表示
- `templates/users/edit.html` - プロフィール編集
- `templates/users/following.html` - フォロー中リスト
- `templates/users/followers.html` - フォロワーリスト

✅ **ユーティリティ**
- `utils/image_handler.py` - 画像処理（既存）

✅ **Blueprint登録**
- `app.py` - usersブループリント登録

---

## まとめ

プロフィール機能は完全に実装されており、以下の機能が利用可能です:

1. ✅ プロフィール表示（画像、統計、投稿一覧）
2. ✅ プロフィール編集（ユーザー名、自己紹介、画像）
3. ✅ 投稿数・フォロー数・フォロワー数の表示
4. ✅ プロフィール画像アップロード（200x200px正方形）
5. ✅ 投稿一覧のグリッド表示
6. ✅ フォロー/アンフォロー機能
7. ✅ フォロー中リスト表示
8. ✅ フォロワーリスト表示
9. ✅ 権限管理（本人のみ編集可能）
10. ✅ CSRFトークン保護

すべての動作確認ポイントをクリアしています。
