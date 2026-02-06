"""
マイグレーション: render_exportsテーブル追加
Step4: 高品質レンダリング確定版＋共有URL
"""
from peewee import *
from models import database


def upgrade():
    """テーブル作成"""
    database.execute_sql('''
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
    database.execute_sql('CREATE INDEX IF NOT EXISTS idx_render_exports_user ON render_exports (user_id)')
    database.execute_sql('CREATE UNIQUE INDEX IF NOT EXISTS idx_render_exports_token ON render_exports (share_token)')
    
    print('✓ render_exportsテーブル作成完了')


def downgrade():
    """テーブル削除"""
    database.execute_sql('DROP TABLE IF EXISTS render_exports')
    print('✓ render_exportsテーブル削除完了')


if __name__ == '__main__':
    # テスト実行用
    from models import init_db
    init_db()
    upgrade()
