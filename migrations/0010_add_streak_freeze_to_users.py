"""
マイグレーション: Userテーブルにstreak_freezeカラムを追加
"""


def apply(db):
    """マイグレーション適用"""
    db.execute_sql("""
        ALTER TABLE users 
        ADD COLUMN streak_freeze INTEGER DEFAULT 2
    """)
    
    db.execute_sql("""
        ALTER TABLE users 
        ADD COLUMN last_freeze_used_at DATE DEFAULT NULL
    """)
    
    print("✓ usersテーブルにstreak_freeze, last_freeze_used_atカラムを追加")


def rollback(db):
    """マイグレーション取り消し"""
    db.execute_sql("ALTER TABLE users DROP COLUMN streak_freeze")
    db.execute_sql("ALTER TABLE users DROP COLUMN last_freeze_used_at")
    print("✓ usersテーブルからstreak_freeze, last_freeze_used_atカラムを削除")
