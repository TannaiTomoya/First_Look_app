from flask import Flask, render_template, g, request, send_from_directory, jsonify, url_for, flash, redirect
from flask_login import LoginManager, current_user
from flask_wtf.csrf import CSRFProtect
from models import db
from models.user import User
from config import get_config
from utils.logging_helper import setup_logging
from typing import Optional
import os

# Flaskアプリケーションの初期化
app = Flask(__name__)

# config.pyから設定を読み込み
config_class = get_config()
app.config.from_object(config_class)

# ログ設定の初期化（秘密情報マスキング機能付き）
setup_logging(app)

# 永続パス用ディレクトリの自動作成
app.logger.info("=" * 60)
app.logger.info("📁 永続パス初期化")
app.logger.info("=" * 60)

# DBディレクトリ作成
db_dir = os.path.dirname(app.config['FIRSTLOOK_DB_PATH'])
if db_dir:  # 空文字列や ':memory:' の場合はスキップ
    os.makedirs(db_dir, exist_ok=True)
    app.logger.info(f"✅ DB ディレクトリ: {db_dir}")

# アップロードディレクトリ作成
upload_dir = app.config['FIRSTLOOK_UPLOAD_DIR']
os.makedirs(upload_dir, exist_ok=True)
app.logger.info(f"✅ Upload ディレクトリ: {upload_dir}")

# Exportディレクトリ作成（Step4-B）
export_dir = app.config['FIRSTLOOK_EXPORT_DIR']
os.makedirs(export_dir, exist_ok=True)
app.logger.info(f"✅ Export ディレクトリ: {export_dir}")

# ログディレクトリ作成
log_dir = app.config['FIRSTLOOK_LOG_DIR']
os.makedirs(log_dir, exist_ok=True)
app.logger.info(f"✅ Log ディレクトリ: {log_dir}")

app.logger.info("=" * 60)

# 起動時のログ出力
app.logger.info("=" * 60)
app.logger.info("🚀 FirstLook アプリケーション起動")
app.logger.info("=" * 60)

# CSRF保護の初期化
csrf = CSRFProtect(app)

# Flask-Loginの初期化
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'
login_manager.login_message = 'ログインが必要です'
login_manager.login_message_category = 'warning'
# セッション保護の設定（config.pyから読み込み）
login_manager.session_protection = app.config['SESSION_PROTECTION']


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

# データベースのテーブル作成（起動時に実行）
app.logger.info("=" * 60)
app.logger.info("📊 データベーステーブルの確認")
app.logger.info("=" * 60)

try:
    from models.render_export import RenderExport
    
    # データベース接続
    if db.is_closed():
        db.connect()
    
    # render_exportsテーブルが存在するか確認
    tables = db.get_tables()
    if 'render_exports' not in tables:
        app.logger.info("⚠️  render_exportsテーブルが存在しません。作成します...")
        db.create_tables([RenderExport], safe=True)
        app.logger.info("✅ render_exportsテーブル作成完了")
    else:
        app.logger.info("✅ render_exportsテーブルは既に存在します")
    
    # 接続を閉じる
    if not db.is_closed():
        db.close()
        
except Exception as e:
    app.logger.error(f"❌ テーブル作成エラー: {str(e)}")

app.logger.info("=" * 60)

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
from routes.client import client
from routes.face_template import face_template
# NOTE: Step4-B時点では未実装のため一旦外す
# from routes.api_face_adjustments import api_adjustments
from routes.api_export import api_export
from routes.share import share_bp
from routes.system import system_bp

app.register_blueprint(auth)
app.register_blueprint(users)
app.register_blueprint(client)
app.register_blueprint(face_template)
# app.register_blueprint(api_adjustments)  # Step4-B: 未実装のため一旦外す
app.register_blueprint(api_export)
app.register_blueprint(share_bp)
app.register_blueprint(system_bp)

# ========================================
# アップロード画像配信
# ========================================

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    """
    アップロードされた画像を配信
    
    セキュリティ：
    - send_from_directoryを使用してパストラバーサル対策
    - FIRSTLOOK_UPLOAD_DIR配下のみアクセス可能
    
    環境変数対応：
    - FIRSTLOOK_UPLOAD_DIR で保存先を切り替え可能
    - ローカル: instance/uploads
    - 本番: /data/uploads 等
    
    Args:
        filename: ファイルパス（サブディレクトリを含む）
    
    Returns:
        画像ファイル（Cache-Control: max-age=86400付き）
    """
    upload_dir = app.config['FIRSTLOOK_UPLOAD_DIR']
    response = send_from_directory(upload_dir, filename)
    # キャッシュ設定（24時間）
    response.headers['Cache-Control'] = 'public, max-age=86400'
    # CORSヘッダー追加（canvas操作のため）
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response


@app.route('/exports/<path:filename>')
def serve_export(filename):
    """
    エクスポートされた画像を配信（Step4追加）
    
    Args:
        filename: ファイル名
    
    Returns:
        画像ファイル
    """
    export_dir = app.config['FIRSTLOOK_EXPORT_DIR']
    response = send_from_directory(export_dir, filename)
    # キャッシュ設定（24時間）
    response.headers['Cache-Control'] = 'public, max-age=86400'
    return response


# ========================================
# ルート定義
# ========================================

@app.route('/')
def index():
    """
    ホーム - FirstLookランディングページ
    ログイン済みの場合は各ロールのダッシュボードへ誘導
    """
    return render_template('index.html')

@app.template_filter('image_url')
def image_url_filter(path, category='profile'):
    """
    画像パスをURLに変換するテンプレートフィルター
    
    新旧の画像パス形式に対応：
    - 新形式: uploads/profile/xxx.webp → /uploads/profile/xxx.webp
    - 旧形式: xxx.jpg → /static/uploads/profiles/xxx.jpg
    
    Args:
        path: 画像パス
        category: 画像カテゴリ（'profile', 'before_after'等）
    
    Returns:
        表示用URL
    """
    if not path:
        return url_for('static', filename='uploads/profiles/default.jpg')
    
    # 新形式（uploads/で始まる）
    if path.startswith('uploads/'):
        return '/' + path
    
    # 旧形式（ファイル名のみ）- 互換性のため
    category_map = {
        'profile': 'profiles',
        'before_after': 'before_after',
        'face_templates': 'face_templates',
        'chat': 'chat'
    }
    folder = category_map.get(category, 'profiles')
    return url_for('static', filename=f'uploads/{folder}/{path}')

@app.errorhandler(413)
def request_entity_too_large(error):
    """
    ファイルサイズ超過エラーハンドラー
    
    MAX_CONTENT_LENGTH を超えるリクエストに対して
    ユーザーフレンドリーなエラーメッセージを表示
    """
    max_size_mb = app.config['MAX_CONTENT_LENGTH'] / (1024 * 1024)
    flash(f'ファイルサイズが大きすぎます。最大{max_size_mb:.0f}MBまでアップロード可能です。', 'danger')
    return redirect(request.referrer or url_for('index')), 413

if __name__ == '__main__':
    # 起動前の設定確認ログ
    app.logger.info("")
    app.logger.info("=" * 60)
    app.logger.info("📋 アプリケーション設定確認")
    app.logger.info("=" * 60)
    app.logger.info(f"環境: {os.environ.get('FLASK_ENV', 'development')}")
    app.logger.info(f"デバッグモード: {app.config['DEBUG']}")
    app.logger.info(f"データベース: {db.database}")
    app.logger.info(f"SECRET_KEY: {'設定済み' if app.config.get('SECRET_KEY') else '未設定'}")
    app.logger.info(f"GEMINI API: {'設定済み' if app.config.get('GOOGLE_GEMINI_API_KEY') else '未設定'}")
    app.logger.info(f"最大アップロード: {app.config['MAX_CONTENT_LENGTH'] / (1024 * 1024):.1f}MB")
    app.logger.info(f"セッションセキュア: {app.config['SESSION_COOKIE_SECURE']}")
    app.logger.info(f"CSRF保護: {app.config['WTF_CSRF_ENABLED']}")
    app.logger.info("=" * 60)
    app.logger.info("")
    
    # PORT環境変数から起動ポートを取得（本番環境対応）
    port = int(os.environ.get('PORT', 8000))
    
    # 開発サーバー起動
    # 本番環境では gunicorn を使用するため、このブロックは実行されない
    app.logger.info(f"開発サーバーをポート {port} で起動中...")
    app.run(
        debug=app.config['DEBUG'],
        port=port,
        host='0.0.0.0'  # コンテナ・本番環境対応（外部からアクセス可能）
    )
