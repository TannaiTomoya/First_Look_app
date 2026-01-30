from flask import Flask, render_template, g, request
from flask_login import LoginManager, current_user
from flask_wtf.csrf import CSRFProtect
from models import db
from models.user import User
from typing import Optional

# Flaskアプリケーションの初期化
app = Flask(__name__)
app.config['SECRET_KEY'] = 'dev-secret-key-change-in-production'

# Flask-Login 1.0.0 セキュリティ設定
app.config['SESSION_COOKIE_SECURE'] = False  # 開発環境はHTTP、本番はTrue
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 1800  # 30分（秒単位）
app.config['REMEMBER_COOKIE_SECURE'] = False  # 開発環境はHTTP、本番はTrue
app.config['REMEMBER_COOKIE_HTTPONLY'] = True
app.config['REMEMBER_COOKIE_DURATION'] = 2592000  # 30日（秒単位）

# CSRF保護の設定
app.config['WTF_CSRF_TIME_LIMIT'] = None  # CSRFトークンの有効期限を無効化（セッション期限に従う）
app.config['WTF_CSRF_SSL_STRICT'] = False  # 開発環境用（本番ではTrue）
app.config['WTF_CSRF_ENABLED'] = True  # CSRF保護を有効化

# CSRF保護の初期化
csrf = CSRFProtect(app)

# Flask-Loginの初期化
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'
login_manager.login_message = 'ログインが必要です'
login_manager.login_message_category = 'warning'
# Flask-Login 1.0.0: セッション保護の強化
login_manager.session_protection = 'strong'  # 'basic', 'strong', or None


@login_manager.user_loader
def load_user(user_id: str) -> Optional[User]:
    """
    ユーザーローダー（Flask-Login 1.0.0対応）
    
    Args:
        user_id: ユーザーID（文字列）
    
    Returns:
        User: ユーザーオブジェクト、見つからない場合はNone
    """
    try:
        return User.select().where(User.id == int(user_id)).first()
    except (ValueError, TypeError):
        return None

# データベース接続の初期化
@app.before_request
def before_request():
    """リクエスト前にデータベース接続を開く"""
    if db.is_closed():
        db.connect()
    g.db = db

@app.after_request
def after_request(response):
    """リクエスト後にデータベース接続を閉じる"""
    if not db.is_closed():
        db.close()
    return response

@app.teardown_appcontext
def close_connection(exception):
    """アプリケーションコンテキスト終了時にデータベース接続を閉じる"""
    if not db.is_closed():
        db.close()

# Blueprintの登録
from routes.auth import auth
from routes.users import users
from routes.coach import coach
from routes.client import client
from routes.booking import booking
from routes.chat import chat_bp
from routes.before_after import before_after

app.register_blueprint(auth)
app.register_blueprint(users)
app.register_blueprint(coach)
app.register_blueprint(client)
app.register_blueprint(booking)
app.register_blueprint(chat_bp)
app.register_blueprint(before_after)

# ルート定義
@app.route('/')
def index():
    """
    ホーム - FirstLookランディングページ
    ログイン済みの場合は各ロールのダッシュボードへ誘導
    """
    return render_template('index.html')

if __name__ == '__main__':
    # データベース初期化確認
    print("FirstLook アプリケーション起動中...")
    print(f"データベース: {db.database}")
    
    # 開発サーバー起動
    app.run(debug=True, port=8000)
