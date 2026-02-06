"""
システム関連エンドポイント

ヘルスチェック、メトリクス等のシステム管理用エンドポイントを提供
"""
from flask import Blueprint, jsonify, current_app
from models import db

system_bp = Blueprint("system", __name__)


@system_bp.route("/healthz")
@system_bp.route("/health")
def healthz():
    """
    ヘルスチェックエンドポイント
    
    本番環境でのヘルスチェック用。
    DBとの接続確認を含む。
    
    ロードバランサー、Kubernetes、監視ツールからの
    定期的なヘルスチェックに使用される。
    
    Returns:
        JSON: ステータスとDB接続状態
        - 200: 正常
        - 500: DB接続エラーまたはその他のエラー
    
    Examples:
        正常時:
        {
            "status": "ok",
            "database": "connected"
        }
        
        異常時:
        {
            "status": "error",
            "database": "disconnected"
        }
    """
    try:
        # DB接続確認（軽量なクエリ）
        db.connect(reuse_if_open=True)
        db.execute_sql("SELECT 1")
        
        return jsonify({
            "status": "ok",
            "database": "connected"
        }), 200
        
    except Exception as e:
        # エラーログ出力
        current_app.logger.error(f"Health check failed: {str(e)}")
        
        return jsonify({
            "status": "error",
            "database": "disconnected"
        }), 500
