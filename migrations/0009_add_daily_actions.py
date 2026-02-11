"""
マイグレーション: daily_actionsテーブル追加
Daily Loop機能（今日の一歩）
"""


def apply(db):
    """テーブル作成"""
    db.execute_sql('''
        CREATE TABLE IF NOT EXISTS daily_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            action_key VARCHAR(50) NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE (user_id, date)
        )
    ''')

    # インデックス作成
    db.execute_sql('CREATE INDEX IF NOT EXISTS idx_daily_actions_user ON daily_actions (user_id)')
    db.execute_sql('CREATE INDEX IF NOT EXISTS idx_daily_actions_date ON daily_actions (date)')
    db.execute_sql('CREATE INDEX IF NOT EXISTS idx_daily_actions_completed ON daily_actions (completed)')

    print('✓ daily_actionsテーブル作成完了')
