#!/usr/bin/env python
"""
Flask-Login 1.0.0 動作確認スクリプト

使用方法:
    python test_flask_login.py
"""
import sys
from flask import Flask
from flask_login import __version__ as flask_login_version
from models import db, User


def check_flask_login_version():
    """Flask-Loginのバージョンを確認"""
    print("\n" + "="*60)
    print("Flask-Login バージョン確認")
    print("="*60)
    print(f"インストール済みバージョン: {flask_login_version}")
    
    if flask_login_version.startswith('1.0'):
        print("✓ Flask-Login 1.0.0 が正しくインストールされています")
        return True
    else:
        print("✗ Flask-Login 1.0.0 がインストールされていません")
        print("実行: pip install Flask-Login==1.0.0")
        return False


def check_user_model():
    """UserモデルがFlask-Login互換か確認"""
    print("\n" + "="*60)
    print("Userモデル互換性チェック")
    print("="*60)
    
    # データベース接続
    db.connect()
    
    # テストユーザーを取得または作成
    test_user = User.select().where(User.username == 'test_user').first()
    
    if not test_user:
        print("テストユーザーが見つかりません（スキップ）")
        db.close()
        return True
    
    # UserMixinのメソッドをチェック
    checks = {
        'is_authenticated': hasattr(test_user, 'is_authenticated'),
        'is_active': hasattr(test_user, 'is_active'),
        'is_anonymous': hasattr(test_user, 'is_anonymous'),
        'get_id()': hasattr(test_user, 'get_id'),
    }
    
    all_passed = True
    for method, exists in checks.items():
        status = "✓" if exists else "✗"
        print(f"{status} {method}: {'存在' if exists else '不足'}")
        if not exists:
            all_passed = False
    
    # get_id()の戻り値をチェック
    if checks['get_id()']:
        user_id = test_user.get_id()
        if isinstance(user_id, str):
            print(f"✓ get_id()の戻り値: {user_id} (str型)")
        else:
            print(f"✗ get_id()の戻り値が文字列ではありません: {type(user_id)}")
            all_passed = False
    
    db.close()
    
    if all_passed:
        print("\n✓ Userモデルは Flask-Login 1.0.0 互換です")
    else:
        print("\n✗ Userモデルに問題があります")
    
    return all_passed


def check_app_config():
    """アプリケーション設定を確認"""
    print("\n" + "="*60)
    print("アプリケーション設定チェック")
    print("="*60)
    
    from app import app
    
    # 必須設定をチェック
    required_configs = {
        'SECRET_KEY': app.config.get('SECRET_KEY'),
        'SESSION_COOKIE_HTTPONLY': app.config.get('SESSION_COOKIE_HTTPONLY'),
        'REMEMBER_COOKIE_HTTPONLY': app.config.get('REMEMBER_COOKIE_HTTPONLY'),
        'PERMANENT_SESSION_LIFETIME': app.config.get('PERMANENT_SESSION_LIFETIME'),
    }
    
    all_set = True
    for config_name, config_value in required_configs.items():
        if config_value is not None:
            print(f"✓ {config_name}: {config_value}")
        else:
            print(f"✗ {config_name}: 未設定")
            all_set = False
    
    # セキュリティ設定の確認
    print("\nセキュリティ設定:")
    security_configs = {
        'SESSION_COOKIE_SECURE': app.config.get('SESSION_COOKIE_SECURE'),
        'REMEMBER_COOKIE_SECURE': app.config.get('REMEMBER_COOKIE_SECURE'),
        'SESSION_COOKIE_SAMESITE': app.config.get('SESSION_COOKIE_SAMESITE'),
    }
    
    for config_name, config_value in security_configs.items():
        print(f"  - {config_name}: {config_value}")
        if config_name.endswith('_SECURE') and config_value is True:
            print("    ⚠️  開発環境ではFalseにすることを推奨")
    
    if all_set:
        print("\n✓ 必須設定は正しく設定されています")
    else:
        print("\n✗ 設定に不足があります")
    
    return all_set


def check_login_manager():
    """LoginManagerの設定を確認"""
    print("\n" + "="*60)
    print("LoginManager設定チェック")
    print("="*60)
    
    from app import login_manager
    
    checks = {
        'login_view': login_manager.login_view,
        'login_message': login_manager.login_message,
        'session_protection': login_manager.session_protection,
    }
    
    for setting, value in checks.items():
        print(f"✓ {setting}: {value}")
    
    # ユーザーローダーが設定されているか確認
    if login_manager.user_callback is not None:
        print("✓ user_loader: 設定済み")
    else:
        print("✗ user_loader: 未設定")
        return False
    
    print("\n✓ LoginManagerは正しく設定されています")
    return True


def main():
    """メイン処理"""
    print("\n" + "="*60)
    print("Flask-Login 1.0.0 動作確認")
    print("="*60)
    
    all_checks_passed = True
    
    # 各チェックを実行
    checks = [
        ("Flask-Loginバージョン", check_flask_login_version),
        ("Userモデル互換性", check_user_model),
        ("アプリケーション設定", check_app_config),
        ("LoginManager設定", check_login_manager),
    ]
    
    for check_name, check_func in checks:
        try:
            result = check_func()
            if not result:
                all_checks_passed = False
        except Exception as e:
            print(f"\n✗ {check_name} でエラーが発生: {e}")
            all_checks_passed = False
    
    # 最終結果
    print("\n" + "="*60)
    if all_checks_passed:
        print("✓ すべてのチェックが完了しました")
        print("Flask-Login 1.0.0 へのアップグレードは成功しています")
        print("="*60)
        return 0
    else:
        print("✗ いくつかのチェックが失敗しました")
        print("FLASK_LOGIN_UPGRADE.md を確認してください")
        print("="*60)
        return 1


if __name__ == '__main__':
    sys.exit(main())
