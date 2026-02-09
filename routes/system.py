"""
システム関連エンドポイント

ヘルスチェック、メトリクス等のシステム管理用エンドポイントを提供
"""
from flask import Blueprint, jsonify

system_bp = Blueprint("system", __name__)


@system_bp.route("/healthz")
@system_bp.route("/health")
def healthz():
    """
    ヘルスチェックエンドポイント
    
    Render.comのHealth Check用。
    migrate前でもエラーにならないよう、DB接続チェックは行わない。
    
    ロードバランサー、Kubernetes、監視ツールからの
    定期的なヘルスチェックに使用される。
    
    Returns:
        JSON: ステータス（常に200 OK）
    
    Note:
        DB接続チェックを含めると、migrate前にunhealthyになるため、
        最小実装としてアプリケーションの起動確認のみ行う。
    """
    return jsonify({"status": "ok"}), 200
