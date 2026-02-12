"""
マイグレーション: Userテーブルにhide_scoresカラムを追加
"""


def apply(db):
    """マイグレーション適用"""
    # カラムが既に存在する場合はスキップ（冪等性）
    cursor = db.execute_sql("PRAGMA table_info(users)")
    existing_columns = {row[1] for row in cursor.fetchall()}

    if 'hide_scores' not in existing_columns:
        db.execute_sql("""
            ALTER TABLE users
            ADD COLUMN hide_scores INTEGER DEFAULT 0
        """)
        print("✓ usersテーブルにhide_scoresカラムを追加")
    else:
        print("⊘ hide_scoresカラムは既に存在（スキップ）")


def rollback(db):
    """マイグレーション取り消し"""
    db.execute_sql("ALTER TABLE users DROP COLUMN hide_scores")
    print("✓ usersテーブルからhide_scoresカラムを削除")
