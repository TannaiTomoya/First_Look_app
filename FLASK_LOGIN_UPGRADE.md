# Flask-Login 1.0.0 アップグレードガイド

## 変更内容

Flask-Login を 0.6.3 から 1.0.0 にアップグレードし、セキュリティとパフォーマンスを強化しました。

## 主な変更点

### 1. セキュリティ強化

#### セッション保護
```python
# app.py
login_manager.session_protection = 'strong'
```

- `'basic'`: IPアドレスの変更を検出
- `'strong'`: IPアドレスとUser-Agentの変更を検出
- `None`: 保護なし

#### Cookie設定
```python
# セッションCookie
SESSION_COOKIE_SECURE = True       # HTTPS必須（本番環境）
SESSION_COOKIE_HTTPONLY = True     # JavaScriptからアクセス不可
SESSION_COOKIE_SAMESITE = 'Lax'    # CSRF対策

# Remember Me Cookie
REMEMBER_COOKIE_SECURE = True      # HTTPS必須（本番環境）
REMEMBER_COOKIE_HTTPONLY = True    # JavaScriptからアクセス不可
REMEMBER_COOKIE_SAMESITE = 'Lax'   # CSRF対策
```

#### オープンリダイレクト対策
```python
# routes/auth.py
def is_safe_url(target):
    """リダイレクト先URLが安全かチェック"""
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme in ('http', 'https') and ref_url.netloc == test_url.netloc

# ログイン時のリダイレクト
if next_page and is_safe_url(next_page):
    return redirect(next_page)
```

### 2. 型ヒント対応

```python
from typing import Optional

@login_manager.user_loader
def load_user(user_id: str) -> Optional[User]:
    """ユーザーローダー"""
    try:
        return User.select().where(User.id == int(user_id)).first()
    except (ValueError, TypeError):
        return None
```

### 3. セッション管理

```python
# セッション有効期限
PERMANENT_SESSION_LIFETIME = 1800  # 30分（無操作でタイムアウト）

# Remember Me有効期限
REMEMBER_COOKIE_DURATION = 2592000  # 30日
```

## 破壊的変更への対応

### 1. ユーザーローダーの例外処理

**変更前:**
```python
@login_manager.user_loader
def load_user(user_id):
    return User.select().where(User.id == int(user_id)).first()
```

**変更後:**
```python
@login_manager.user_loader
def load_user(user_id: str) -> Optional[User]:
    try:
        return User.select().where(User.id == int(user_id)).first()
    except (ValueError, TypeError):
        return None
```

### 2. login_user()の引数

**変更前:**
```python
login_user(user, remember=form.remember_me.data)
```

**変更後:**
```python
login_user(user, remember=form.remember_me.data, duration=None)
```

## 本番環境への展開

### 環境変数の設定

```bash
# 必須
export SECRET_KEY='your-secret-key-here'
export FLASK_ENV='production'

# 推奨
export SESSION_COOKIE_SECURE=True
export REMEMBER_COOKIE_SECURE=True
```

### HTTPSの設定

本番環境では必ずHTTPSを使用してください：

1. SSL証明書の取得（Let's Encryptなど）
2. Webサーバー（Nginx/Apache）でHTTPSを設定
3. `app.config`の`*_SECURE`フラグを`True`に設定

### 設定ファイルの使用

```python
# app.py
from config import config

app = Flask(__name__)
app.config.from_object(config['production'])
```

## テスト

### 開発環境での動作確認

```bash
# 依存関係の更新
pip install -r requirements.txt

# データベースのリセット（必要に応じて）
python db_manager.py reset
python db_manager.py seed

# アプリケーションの起動
python app.py
```

### 確認項目

- [ ] ログイン/ログアウトが正常に動作する
- [ ] Remember Me機能が動作する
- [ ] セッションタイムアウト（30分）が機能する
- [ ] オープンリダイレクト攻撃が防がれる
- [ ] CSRFトークンが正しく検証される

## トラブルシューティング

### セッションが保持されない

**原因:** Cookie設定が厳しすぎる

**解決策:**
```python
# 開発環境の場合
SESSION_COOKIE_SECURE = False
REMEMBER_COOKIE_SECURE = False
```

### ログイン後すぐにログアウトされる

**原因:** セッション保護が'strong'で、User-Agentが変化している

**解決策:**
```python
# session_protectionを'basic'に変更
login_manager.session_protection = 'basic'
```

### Remember Meが機能しない

**原因:** Cookie期限設定の問題

**確認:**
```python
# デフォルトは30日
REMEMBER_COOKIE_DURATION = 2592000  # 秒単位
```

## 参考資料

- [Flask-Login 1.0.0 ドキュメント](https://flask-login.readthedocs.io/)
- [Flask-Login Changelog](https://github.com/maxcountryman/flask-login/blob/main/CHANGES.md)
- [OWASP セッション管理チートシート](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

## バージョン情報

- Flask-Login: 0.6.3 → 1.0.0
- Flask: 3.1.2
- Python: 3.13+

更新日: 2026-01-27
