"""
FaceCompositionテーブルにadjustmentsカラムを追加
"""
import sys
import os

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import db
from playhouse.migrate import migrate, SqliteMigrator
from peewee import TextField

def run_migration():
    """マイグレーション実行"""
    print("マイグレーション開始: adjustmentsカラム追加")
    
    migrator = SqliteMigrator(db)
    
    # adjustmentsカラムを追加
    migrate(
        migrator.add_column('face_compositions', 'adjustments', TextField(null=True))
    )
    
    print("✓ マイグレーション完了")

if __name__ == '__main__':
    run_migration()
