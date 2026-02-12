"""
マイグレーション: event_logsテーブルを追加
"""


def apply(db):
    """マイグレーション適用"""
    db.execute_sql("""
        CREATE TABLE IF NOT EXISTS event_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT NULL,
            event VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    """)
    
    db.execute_sql("""
        CREATE INDEX IF NOT EXISTS idx_event_logs_user_event 
        ON event_logs(user_id, event)
    """)
    
    db.execute_sql("""
        CREATE INDEX IF NOT EXISTS idx_event_logs_created_at 
        ON event_logs(created_at)
    """)
    
    print("✓ event_logsテーブルを作成")


def rollback(db):
    """マイグレーション取り消し"""
    db.execute_sql("DROP TABLE IF EXISTS event_logs")
    print("✓ event_logsテーブルを削除")
