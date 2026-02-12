"""
マイグレーション: achievementsテーブルを追加
"""


def apply(db):
    """マイグレーション適用"""
    db.execute_sql("""
        CREATE TABLE IF NOT EXISTS achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key VARCHAR(50) NOT NULL,
            earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, key)
        )
    """)
    
    db.execute_sql("""
        CREATE INDEX IF NOT EXISTS idx_achievements_user 
        ON achievements(user_id)
    """)
    
    print("✓ achievementsテーブルを作成")


def rollback(db):
    """マイグレーション取り消し"""
    db.execute_sql("DROP TABLE IF EXISTS achievements")
    print("✓ achievementsテーブルを削除")
