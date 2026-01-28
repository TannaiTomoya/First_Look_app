"""
Flask アプリケーション設定（Flask-Login 1.0.0対応）
"""
import os


class Config:
    """基本設定"""
    # Flask基本設定
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # データベース設定
    DATABASE_PATH = os.environ.get('DATABASE_PATH') or 'instance/photoapp.db'
    
    # Flask-Login 1.0.0 セッション設定
    SESSION_COOKIE_SECURE = False  # HTTPSの場合True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = 1800  # 30分（秒単位）
    
    # Remember Me Cookie設定
    REMEMBER_COOKIE_SECURE = False  # HTTPSの場合True
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_DURATION = 2592000  # 30日（秒単位）
    REMEMBER_COOKIE_SAMESITE = 'Lax'
    
    # Flask-Login セッション保護
    SESSION_PROTECTION = 'strong'  # 'basic', 'strong', or None


class DevelopmentConfig(Config):
    """開発環境設定"""
    DEBUG = True
    SESSION_COOKIE_SECURE = False
    REMEMBER_COOKIE_SECURE = False


class ProductionConfig(Config):
    """本番環境設定"""
    DEBUG = False
    # 本番環境ではHTTPSを使用するため、Secureフラグを有効化
    SESSION_COOKIE_SECURE = True
    REMEMBER_COOKIE_SECURE = True
    # 本番環境では環境変数からSECRET_KEYを取得必須
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY環境変数が設定されていません")


class TestingConfig(Config):
    """テスト環境設定"""
    TESTING = True
    WTF_CSRF_ENABLED = False
    DATABASE_PATH = ':memory:'


# 環境変数から設定を選択
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
