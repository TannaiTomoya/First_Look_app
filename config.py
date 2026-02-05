"""
Flask アプリケーション設定（Flask-Login 1.0.0対応）
環境変数による設定管理
"""
import os
import logging
from dotenv import load_dotenv

# .envファイルを読み込み
load_dotenv()


class Config:
    """基本設定"""
    # Flask基本設定
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    # データベース設定（FIRSTLOOK_DB_PATHに統一）
    FIRSTLOOK_DB_PATH = os.environ.get('FIRSTLOOK_DB_PATH', 'instance/firstlook.db')
    # 互換性のため DATABASE_PATH も保持（廃止予定）
    DATABASE_PATH = FIRSTLOOK_DB_PATH
    
    # API設定
    GOOGLE_GEMINI_API_KEY = os.environ.get('GOOGLE_GEMINI_API_KEY')
    
    # アップロード設定
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  # デフォルト16MB
    
    # Flask-Login 1.0.0 セッション設定
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'False').lower() == 'true'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = 1800  # 30分（秒単位）
    
    # Remember Me Cookie設定
    REMEMBER_COOKIE_SECURE = os.environ.get('REMEMBER_COOKIE_SECURE', 'False').lower() == 'true'
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_DURATION = 2592000  # 30日（秒単位）
    REMEMBER_COOKIE_SAMESITE = 'Lax'
    
    # Flask-Login セッション保護
    SESSION_PROTECTION = 'strong'  # 'basic', 'strong', or None
    
    # CSRF保護設定
    WTF_CSRF_TIME_LIMIT = None  # CSRFトークンの有効期限を無効化（セッション期限に従う）
    WTF_CSRF_SSL_STRICT = False  # 開発環境用（本番ではTrue）
    WTF_CSRF_ENABLED = True  # CSRF保護を有効化
    
    # ログ設定
    LOG_LEVEL = logging.INFO
    LOG_FORMAT = '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
    
    # 秘密情報マスキング用（ログに出力してはいけないキーワード）
    SENSITIVE_KEYS = ['SECRET_KEY', 'GOOGLE_GEMINI_API_KEY', 'password', 'api_key', 'token']


class DevelopmentConfig(Config):
    """開発環境設定"""
    DEBUG = True
    SESSION_COOKIE_SECURE = False
    REMEMBER_COOKIE_SECURE = False
    WTF_CSRF_SSL_STRICT = False
    
    # 開発環境では詳細ログ
    LOG_LEVEL = logging.DEBUG


class ProductionConfig(Config):
    """本番環境設定"""
    DEBUG = False
    # 本番環境ではHTTPSを使用するため、Secureフラグを有効化
    SESSION_COOKIE_SECURE = True
    REMEMBER_COOKIE_HTTPONLY = True  # 明示的に設定
    REMEMBER_COOKIE_SECURE = True
    WTF_CSRF_SSL_STRICT = True
    
    # 本番環境では環境変数からSECRET_KEYを取得必須
    # 注意: 検証は get_config() 関数で実行される
    SECRET_KEY = os.environ.get('SECRET_KEY')
    GOOGLE_GEMINI_API_KEY = os.environ.get('GOOGLE_GEMINI_API_KEY')
    
    # 本番環境はINFOレベルのログ（DEBUGは出さない）
    LOG_LEVEL = logging.INFO


class TestingConfig(Config):
    """テスト環境設定"""
    TESTING = True
    DEBUG = True
    WTF_CSRF_ENABLED = False
    
    # テスト環境はインメモリDB（FIRSTLOOK_DB_PATHに統一）
    FIRSTLOOK_DB_PATH = ':memory:'
    DATABASE_PATH = ':memory:'
    
    SESSION_COOKIE_SECURE = False
    REMEMBER_COOKIE_SECURE = False
    
    # テスト環境ではDEBUGレベルのログ
    LOG_LEVEL = logging.DEBUG


# 環境変数から設定を選択
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config():
    """
    環境に応じた設定クラスを取得
    
    本番環境の場合、セキュリティチェックを実行：
    - SECRET_KEYの存在確認
    - 開発用SECRET_KEYの使用を禁止
    - SECRET_KEYの長さチェック（最低32文字）
    - GOOGLE_GEMINI_API_KEYの存在確認
    
    Returns:
        Config: 環境に応じた設定クラス
        
    Raises:
        ValueError: 本番環境でセキュリティ要件を満たさない場合
    """
    env = os.environ.get('FLASK_ENV', 'development')
    config_class = config.get(env, config['default'])
    
    # 本番環境のセキュリティチェック
    if env == 'production':
        secret_key = config_class.SECRET_KEY
        
        # SECRET_KEYの存在チェック
        if not secret_key:
            raise ValueError(
                "🚨 本番環境起動エラー 🚨\n\n"
                "SECRET_KEY環境変数が設定されていません。\n\n"
                "対処方法:\n"
                "1. 安全なランダム文字列を生成:\n"
                "   python -c 'import secrets; print(secrets.token_hex(32))'\n\n"
                "2. 環境変数に設定:\n"
                "   export SECRET_KEY='生成された文字列'\n\n"
                "3. または .env ファイルに追加:\n"
                "   SECRET_KEY=生成された文字列"
            )
        
        # 開発用SECRET_KEYで本番起動を防ぐ（セキュリティガード）
        DEVELOPMENT_SECRET_KEYS = [
            'dev-secret-key-change-in-production',
            'dev',
            'development',
            'secret',
            'changeme',
            'your-secret-key-here',
            'your-secret-key-here-change-in-production'
        ]
        
        if secret_key in DEVELOPMENT_SECRET_KEYS:
            raise ValueError(
                f"🚨 セキュリティエラー 🚨\n\n"
                f"本番環境で開発用のSECRET_KEY '{secret_key}' が検出されました。\n"
                f"これは重大なセキュリティリスクです！\n\n"
                f"対処方法:\n"
                f"1. 安全なランダム文字列を生成:\n"
                f"   python -c 'import secrets; print(secrets.token_hex(32))'\n\n"
                f"2. 環境変数に設定:\n"
                f"   export SECRET_KEY='生成された文字列'\n\n"
                f"3. または .env ファイルに追加:\n"
                f"   SECRET_KEY=生成された文字列\n\n"
                f"注意: 開発用のキーは絶対に本番環境で使用しないでください。"
            )
        
        # SECRET_KEYの長さチェック（最低32文字）
        if len(secret_key) < 32:
            raise ValueError(
                f"🚨 本番環境起動エラー 🚨\n\n"
                f"SECRET_KEYが短すぎます（現在: {len(secret_key)}文字、必要: 32文字以上）\n\n"
                f"対処方法:\n"
                f"1. 安全なランダム文字列を生成:\n"
                f"   python -c 'import secrets; print(secrets.token_hex(32))'\n\n"
                f"2. 生成された文字列を環境変数またはに.envファイルに設定してください。"
            )
        
        # Gemini APIキーも必須
        if not config_class.GOOGLE_GEMINI_API_KEY:
            raise ValueError(
                "🚨 本番環境起動エラー 🚨\n\n"
                "GOOGLE_GEMINI_API_KEY環境変数が設定されていません。\n"
                "AI診断機能を使用する場合は、APIキーを設定してください。"
            )
    
    # 設定情報をログ出力（デバッグ用）
    print(f"[Config] 環境: {env}")
    print(f"[Config] DEBUG: {config_class.DEBUG}")
    print(f"[Config] DATABASE: {config_class.FIRSTLOOK_DB_PATH}")
    print(f"[Config] GEMINI API: {'設定済み' if config_class.GOOGLE_GEMINI_API_KEY else '未設定'}")
    print(f"[Config] MAX_UPLOAD: {config_class.MAX_CONTENT_LENGTH / (1024 * 1024):.1f}MB")
    print(f"[Config] SESSION_COOKIE_SECURE: {config_class.SESSION_COOKIE_SECURE}")
    print(f"[Config] LOG_LEVEL: {logging.getLevelName(config_class.LOG_LEVEL)}")
    
    return config_class
