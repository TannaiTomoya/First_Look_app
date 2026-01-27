from flask import Flask, render_template, g, request
from flask_login import LoginManager, current_user
from flask_wtf.csrf import CSRFProtect
from models import db
from models.user import User

# Flaskアプリケーションの初期化
app = Flask(__name__)
app.config['SECRET_KEY'] = 'dev-secret-key-change-in-production'

# CSRF保護の初期化
csrf = CSRFProtect(app)

# Flask-Loginの初期化
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'
login_manager.login_message = 'ログインが必要です'
login_manager.login_message_category = 'warning'


@login_manager.user_loader
def load_user(user_id):
    """ユーザーローダー"""
    return User.select().where(User.id == int(user_id)).first()

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
from routes.posts import posts
from routes.api import api
from routes.users import users
from routes.search import search

app.register_blueprint(auth)
app.register_blueprint(posts)
app.register_blueprint(api)
app.register_blueprint(users)
app.register_blueprint(search)

# ルート定義
@app.route('/')
def index():
    """
    ホームフィード - フォロー中のユーザーと自分の投稿を表示
    未ログインの場合はランディングページを表示
    """
    # 未ログインの場合はランディングページを表示
    if not current_user.is_authenticated:
        return render_template('index.html')
    
    # ログイン中の場合はホームフィードを表示
    from models.post import get_timeline_posts
    
    # ページネーション設定
    page = request.args.get('page', 1, type=int)
    per_page = 12  # 1ページあたりの投稿数（グリッド表示用）
    
    # フォロー中のユーザーと自分の投稿を取得
    timeline_posts = get_timeline_posts(current_user)
    total_posts = timeline_posts.count()
    
    # ページネーション処理
    posts_paginated = timeline_posts.paginate(page, per_page)
    
    # ページ情報
    has_prev = page > 1
    has_next = page * per_page < total_posts
    prev_page = page - 1 if has_prev else None
    next_page = page + 1 if has_next else None
    
    return render_template(
        'posts/index.html',
        posts=posts_paginated,
        page=page,
        has_prev=has_prev,
        has_next=has_next,
        prev_page=prev_page,
        next_page=next_page
    )

if __name__ == '__main__':
    # データベース初期化確認
    print("アプリケーション起動中...")
    print(f"データベース: {db.database}")
    
    # 開発サーバー起動
    app.run(debug=True, port=8000)
