"""
データベース設定 - FirstLook

DBパスの単一ソース。環境変数優先、デフォルトは instance/firstlook.db
"""
import os
from peewee import SqliteDatabase


def get_db_path() -> str:
    """
    データベースパスを取得
    
    優先順位:
    1. FIRSTLOOK_DB_PATH 環境変数
    2. instance/firstlook.db（デフォルト）
    
    Returns:
        str: データベースファイルのパス
    """
    return os.getenv("FIRSTLOOK_DB_PATH", os.path.join("instance", "firstlook.db"))


# データベースインスタンス（グローバル）
db = SqliteDatabase(
    get_db_path(),
    pragmas={
        "foreign_keys": 1,        # 外部キー制約を有効化
        "journal_mode": "wal",    # Write-Ahead Logging（並行性向上）
    }
)


def init_db_directory():
    """instanceディレクトリを作成（存在しない場合）"""
    db_path = get_db_path()
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
        print(f"[DB] ディレクトリ作成: {db_dir}")


# 初期化時にディレクトリを確保
init_db_directory()
