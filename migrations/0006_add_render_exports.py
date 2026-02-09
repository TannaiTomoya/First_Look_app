"""
マイグレーション: render_exportsテーブル追加
Step4: 高品質レンダリング確定版＋共有URL
"""


def apply(db):
    """テーブル作成"""
    db.execute_sql('''
        CREATE TABLE IF NOT EXISTS render_exports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            template_id INTEGER NOT NULL,
            state_json TEXT NOT NULL,
            output_path TEXT NOT NULL,
            share_token TEXT NOT NULL UNIQUE,
            is_public INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (template_id) REFERENCES face_templates (id) ON DELETE CASCADE
        )
    ''')
    
    # インデックス作成
    db.execute_sql('CREATE INDEX IF NOT EXISTS idx_render_exports_user ON render_exports (user_id)')
    db.execute_sql('CREATE UNIQUE INDEX IF NOT EXISTS idx_render_exports_token ON render_exports (share_token)')
    
    print('✓ render_exportsテーブル作成完了')
