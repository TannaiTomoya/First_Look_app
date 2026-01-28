#!/usr/bin/env python
"""
チャットメッセージテーブルのマイグレーション
画像添付と削除機能のためのカラムを追加
"""
from models import db

def migrate():
    """Messageテーブルにカラムを追加"""
    print("チャットメッセージテーブルをマイグレーション中...")
    
    db.connect()
    
    try:
        # 既存のカラムをチェック
        cursor = db.execute_sql("PRAGMA table_info(messages)")
        columns = [row[1] for row in cursor.fetchall()]
        
        # image_pathカラムを追加
        if 'image_path' not in columns:
            print("  - image_path カラムを追加中...")
            db.execute_sql("ALTER TABLE messages ADD COLUMN image_path VARCHAR(255) NULL")
            print("    ✓ image_path カラムを追加しました")
        else:
            print("    - image_path カラムは既に存在します")
        
        # is_deletedカラムを追加
        if 'is_deleted' not in columns:
            print("  - is_deleted カラムを追加中...")
            db.execute_sql("ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0")
            print("    ✓ is_deleted カラムを追加しました")
        else:
            print("    - is_deleted カラムは既に存在します")
        
        # deleted_atカラムを追加
        if 'deleted_at' not in columns:
            print("  - deleted_at カラムを追加中...")
            db.execute_sql("ALTER TABLE messages ADD COLUMN deleted_at DATETIME NULL")
            print("    ✓ deleted_at カラムを追加しました")
        else:
            print("    - deleted_at カラムは既に存在します")
        
        print("\n✓ マイグレーション完了")
        
    except Exception as e:
        print(f"\n✗ マイグレーション失敗: {e}")
        raise
    
    finally:
        if not db.is_closed():
            db.close()

if __name__ == '__main__':
    migrate()
