"""
マイグレーション: Userテーブルにstreak_freezeカラムを追加
"""


def apply(db):
    """マイグレーション適用"""
    # カラムが既に存在する場合はスキップ（冪等性）
    cursor = db.execute_sql("PRAGMA table_info(users)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    
    if 'streak_freeze' not in existing_columns:
        db.execute_sql("""
            ALTER TABLE users 
            ADD COLUMN streak_freeze INTEGER DEFAULT 2
        """)
        print("✓ usersテーブルにstreak_freezeカラムを追加")
    else:
        print("⊘ streak_freezeカラムは既に存在（スキップ）")
    
    if 'last_freeze_used_at' not in existing_columns:
        db.execute_sql("""
            ALTER TABLE users 
            ADD COLUMN last_freeze_used_at DATE DEFAULT NULL
        """)
        print("✓ usersテーブルにlast_freeze_used_atカラムを追加")
    else:
        print("⊘ last_freeze_used_atカラムは既に存在（スキップ）")


def rollback(db):
    """マイグレーション取り消し"""
    db.execute_sql("ALTER TABLE users DROP COLUMN streak_freeze")
    db.execute_sql("ALTER TABLE users DROP COLUMN last_freeze_used_at")
    print("✓ usersテーブルからstreak_freeze, last_freeze_used_atカラムを削除")
