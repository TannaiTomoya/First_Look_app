"""
マイグレーション: look_recordsテーブル追加
Future Face機能による見た目記録
"""


def apply(db):
    """テーブル作成"""
    db.execute_sql('''
        CREATE TABLE IF NOT EXISTS look_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            photo_path VARCHAR(255) NOT NULL,
            preset VARCHAR(20) NOT NULL,
            strength INTEGER NOT NULL DEFAULT 40,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE (user_id, date)
        )
    ''')
    
    # インデックス作成
    db.execute_sql('CREATE INDEX IF NOT EXISTS idx_look_records_user ON look_records (user_id)')
    db.execute_sql('CREATE INDEX IF NOT EXISTS idx_look_records_date ON look_records (date)')
    
    print('✓ look_recordsテーブル作成完了')
