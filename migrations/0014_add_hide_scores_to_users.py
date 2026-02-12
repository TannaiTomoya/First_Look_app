"""
マイグレーション: Userテーブルにhide_scoresカラムを追加
"""


def apply(db):
    """マイグレーション適用"""
    db.execute_sql("""
        ALTER TABLE users
        ADD COLUMN hide_scores INTEGER DEFAULT 0
    """)

    print("✓ usersテーブルにhide_scoresカラムを追加")


def rollback(db):
    """マイグレーション取り消し"""
    db.execute_sql("ALTER TABLE users DROP COLUMN hide_scores")
    print("✓ usersテーブルからhide_scoresカラムを削除")
