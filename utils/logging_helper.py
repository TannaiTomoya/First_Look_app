"""
ログヘルパー - 秘密情報のマスキング

本番環境でのログ出力時に、APIキーやパスワードなどの
秘密情報を自動的にマスキングします。
"""
import re
import logging
from typing import Optional


def mask_sensitive_data(text: str, sensitive_keys: Optional[list] = None) -> str:
    """
    秘密情報をマスキング
    
    以下のパターンを自動検出してマスキング：
    - Google APIキー（AIza...）
    - Base64画像データ（data:image/...;base64,...）
    - 指定されたキーワードに続く値
    
    Args:
        text: ログメッセージ
        sensitive_keys: マスキング対象のキーワードリスト
    
    Returns:
        マスキングされたテキスト
    """
    if not text:
        return text
    
    masked = text
    
    # Google APIキーのマスキング（例: AIzaSy... → AIza****）
    masked = re.sub(r'AIza\w{35}', 'AIza****[MASKED_API_KEY]', masked)
    
    # Base64画像データのマスキング（長い文字列を短縮）
    masked = re.sub(
        r'data:image/[^;]+;base64,[A-Za-z0-9+/=]{50,}', 
        'data:image/...;base64,[MASKED_IMAGE_DATA]', 
        masked
    )
    
    # 一般的なパスワード・トークンパターン
    masked = re.sub(
        r'(password|passwd|pwd|token|secret)["\']?\s*[:=]\s*["\']?([^"\'\s,}]{3,})',
        r'\1=****[MASKED]',
        masked,
        flags=re.IGNORECASE
    )
    
    # カスタムキーワードのマスキング
    if sensitive_keys:
        for key in sensitive_keys:
            # key=value 形式
            pattern = f'{key}["\']?\s*[:=]\s*["\']?([^"\'\s,}}]+)'
            masked = re.sub(pattern, f'{key}=****[MASKED]', masked, flags=re.IGNORECASE)
    
    return masked


class SensitiveDataFilter(logging.Filter):
    """
    ログフィルター - 秘密情報を自動マスキング
    
    すべてのログメッセージに対して mask_sensitive_data() を適用します。
    """
    
    def __init__(self, sensitive_keys: Optional[list] = None):
        """
        Args:
            sensitive_keys: マスキング対象のキーワードリスト
        """
        super().__init__()
        self.sensitive_keys = sensitive_keys or []
    
    def filter(self, record):
        """
        ログレコードをフィルタリング（マスキング）
        
        Args:
            record: LogRecordオブジェクト
        
        Returns:
            True（常に記録する、ただしマスキング後）
        """
        if hasattr(record, 'msg') and isinstance(record.msg, str):
            record.msg = mask_sensitive_data(record.msg, self.sensitive_keys)
        
        # argsもマスキング
        if hasattr(record, 'args') and record.args:
            masked_args = []
            for arg in record.args:
                if isinstance(arg, str):
                    masked_args.append(mask_sensitive_data(arg, self.sensitive_keys))
                else:
                    masked_args.append(arg)
            record.args = tuple(masked_args)
        
        return True


def setup_logging(app):
    """
    アプリケーションのログ設定
    
    環境に応じたログレベルと秘密情報マスキングを設定します。
    
    Args:
        app: Flaskアプリケーションインスタンス
    """
    # ログレベル設定
    log_level = app.config.get('LOG_LEVEL', logging.INFO)
    app.logger.setLevel(log_level)
    
    # 既存のハンドラーをクリア
    app.logger.handlers.clear()
    
    # コンソールハンドラー設定
    handler = logging.StreamHandler()
    handler.setLevel(log_level)
    
    # フォーマット設定
    formatter = logging.Formatter(
        app.config.get('LOG_FORMAT', '[%(asctime)s] %(levelname)s: %(message)s')
    )
    handler.setFormatter(formatter)
    
    # 秘密情報マスキングフィルターを追加
    sensitive_keys = app.config.get('SENSITIVE_KEYS', [])
    sensitive_filter = SensitiveDataFilter(sensitive_keys)
    handler.addFilter(sensitive_filter)
    
    app.logger.addHandler(handler)
    
    # Werkzeugのログレベルも調整（本番環境では冗長なログを抑制）
    werkzeug_level = logging.WARNING if log_level == logging.INFO else logging.INFO
    logging.getLogger('werkzeug').setLevel(werkzeug_level)
    
    # ログ設定完了を記録
    app.logger.info(f"ログ設定完了: レベル={logging.getLevelName(log_level)}")
    
    return app.logger
