"""
Task 04-1 受け入れ基準テスト

1. FLASK_ENV=production で起動しても DEBUG が ON にならない
2. SECRET_KEY が未設定なら起動時に明確にエラーで落ちる
3. 本番設定でログイン/登録/主要画面が 500 にならない（手動確認）
4. Cookie が Secure/HttpOnly で付与される（https 前提）
"""
import os
import sys

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def test_production_config():
    """本番設定のテスト"""
    print("\n" + "=" * 60)
    print("Test 1: 本番設定（production）で DEBUG が OFF になることを確認")
    print("=" * 60)
    
    # 環境変数を一時的に設定
    original_env = os.environ.get('FLASK_ENV')
    original_secret = os.environ.get('SECRET_KEY')
    
    os.environ['FLASK_ENV'] = 'production'
    os.environ['SECRET_KEY'] = 'production-secret-key-for-testing'
    
    # config.py をリロード
    from config import get_config
    config = get_config()
    
    assert config.DEBUG == False, "❌ 本番環境でDEBUGがTrueです"
    assert config.SESSION_COOKIE_SECURE == True, "❌ 本番環境でSESSION_COOKIE_SECUREがFalseです"
    assert config.REMEMBER_COOKIE_SECURE == True, "❌ 本番環境でREMEMBER_COOKIE_SECUREがFalseです"
    assert config.WTF_CSRF_SSL_STRICT == True, "❌ 本番環境でCSRF SSL STRICTがFalseです"
    
    print("✅ 本番設定が正しく動作しています")
    print(f"  - DEBUG: {config.DEBUG}")
    print(f"  - SESSION_COOKIE_SECURE: {config.SESSION_COOKIE_SECURE}")
    print(f"  - REMEMBER_COOKIE_SECURE: {config.REMEMBER_COOKIE_SECURE}")
    print(f"  - WTF_CSRF_SSL_STRICT: {config.WTF_CSRF_SSL_STRICT}")
    
    # 環境変数を元に戻す
    if original_env:
        os.environ['FLASK_ENV'] = original_env
    else:
        os.environ.pop('FLASK_ENV', None)
    
    if original_secret:
        os.environ['SECRET_KEY'] = original_secret
    else:
        os.environ.pop('SECRET_KEY', None)


def test_dev_secret_key_rejection():
    """開発用SECRET_KEYが本番環境で拒否されることを確認"""
    print("\n" + "=" * 60)
    print("Test 2: 本番環境で開発用SECRET_KEYが拒否されることを確認")
    print("=" * 60)
    
    original_env = os.environ.get('FLASK_ENV')
    original_secret = os.environ.get('SECRET_KEY')
    
    os.environ['FLASK_ENV'] = 'production'
    os.environ['SECRET_KEY'] = 'dev-secret-key-change-in-production'
    
    try:
        # Pythonモジュールのキャッシュをクリア
        if 'config' in sys.modules:
            del sys.modules['config']
        
        from config import get_config
        get_config()
        
        print("❌ 開発用SECRET_KEYが本番環境で受け入れられてしまいました")
        assert False, "開発用SECRET_KEYが本番環境で拒否されませんでした"
        
    except ValueError as e:
        if '開発用のSECRET_KEY' in str(e):
            print("✅ 開発用SECRET_KEYが正しく拒否されました")
            print(f"  エラーメッセージ: {str(e)[:100]}...")
        else:
            print(f"❌ 予期しないエラー: {e}")
            raise
    finally:
        # 環境変数を元に戻す
        if original_env:
            os.environ['FLASK_ENV'] = original_env
        else:
            os.environ.pop('FLASK_ENV', None)
        
        if original_secret:
            os.environ['SECRET_KEY'] = original_secret
        else:
            os.environ.pop('SECRET_KEY', None)
        
        # モジュールキャッシュをクリア
        if 'config' in sys.modules:
            del sys.modules['config']


def test_db_path_unified():
    """DBパスがFIRSTLOOK_DB_PATHに統一されていることを確認"""
    print("\n" + "=" * 60)
    print("Test 3: DBパスがFIRSTLOOK_DB_PATHに統一されていることを確認")
    print("=" * 60)
    
    original_path = os.environ.get('FIRSTLOOK_DB_PATH')
    test_path = '/tmp/test_firstlook.db'
    
    os.environ['FIRSTLOOK_DB_PATH'] = test_path
    
    # モジュールをリロード
    if 'config' in sys.modules:
        del sys.modules['config']
    if 'db' in sys.modules:
        del sys.modules['db']
    
    from config import get_config
    config = get_config()
    
    assert config.FIRSTLOOK_DB_PATH == test_path, f"❌ FIRSTLOOK_DB_PATHが設定されていません: {config.FIRSTLOOK_DB_PATH}"
    
    print("✅ DBパスがFIRSTLOOK_DB_PATHから正しく読み込まれています")
    print(f"  - FIRSTLOOK_DB_PATH: {config.FIRSTLOOK_DB_PATH}")
    
    # 環境変数を元に戻す
    if original_path:
        os.environ['FIRSTLOOK_DB_PATH'] = original_path
    else:
        os.environ.pop('FIRSTLOOK_DB_PATH', None)
    
    # モジュールキャッシュをクリア
    if 'config' in sys.modules:
        del sys.modules['config']
    if 'db' in sys.modules:
        del sys.modules['db']


def test_sensitive_data_masking():
    """秘密情報のマスキングテスト"""
    print("\n" + "=" * 60)
    print("Test 4: 秘密情報のマスキング機能を確認")
    print("=" * 60)
    
    from utils.logging_helper import mask_sensitive_data
    
    # Google APIキーのマスキング
    text1 = "GOOGLE_GEMINI_API_KEY=AIzaSyAwTib_lcA9Fdj01PGjeP27J1j9waB6Tv0"
    masked1 = mask_sensitive_data(text1)
    assert 'AIzaSyAwTib_lcA9Fdj01PGjeP27J1j9waB6Tv0' not in masked1, "❌ APIキーがマスキングされていません"
    assert 'AIza****' in masked1, "❌ APIキーのマスキング形式が間違っています"
    print(f"✅ APIキーのマスキング: {masked1}")
    
    # Base64画像データのマスキング
    text2 = "image_data: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a..."
    masked2 = mask_sensitive_data(text2)
    assert '/9j/4AAQSkZJRgABAQAAAQABAAD' not in masked2, "❌ Base64データがマスキングされていません"
    assert '[MASKED_IMAGE_DATA]' in masked2, "❌ Base64データのマスキング形式が間違っています"
    print(f"✅ Base64データのマスキング: {masked2[:100]}...")
    
    # パスワードのマスキング
    text3 = "password=mysecretpassword123"
    masked3 = mask_sensitive_data(text3)
    assert 'mysecretpassword123' not in masked3, "❌ パスワードがマスキングされていません"
    assert 'password=****[MASKED]' in masked3, "❌ パスワードのマスキング形式が間違っています"
    print(f"✅ パスワードのマスキング: {masked3}")
    
    print("\n✅ すべてのマスキングテストが成功しました")


if __name__ == '__main__':
    try:
        test_production_config()
        test_dev_secret_key_rejection()
        test_db_path_unified()
        test_sensitive_data_masking()
        
        print("\n" + "=" * 60)
        print("🎉 すべてのテストが成功しました")
        print("=" * 60)
        print("\n次の手動確認を実施してください：")
        print("1. 本番設定でログイン/登録/主要画面が500にならないことを確認")
        print("2. ブラウザで Cookie の Secure/HttpOnly フラグを確認（HTTPS環境）")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ テスト失敗: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
