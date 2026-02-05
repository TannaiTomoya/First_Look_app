#!/usr/bin/env python
"""
⚠️ 【使用禁止】旧形式マイグレーション - 参考用のみ ⚠️

このファイルは参考用として保持されています。
今後のスキーマ変更は migrations/ ディレクトリに追加してください。

詳細: MIGRATIONS_README.md を参照

---

性別カラム追加マイグレーション

既存のユーザーに gender カラムを追加し、デフォルト値 'male' を設定
"""
from models import db
from peewee import CharField

def migrate():
    """性別カラムをusersテーブルに追加"""
    print("マイグレーション開始: 性別カラム追加")
    
    db.connect()
    
    try:
        # SQLiteで列を追加
        db.execute_sql('ALTER TABLE users ADD COLUMN gender VARCHAR(10) DEFAULT "male"')
        print("✓ gender カラムを追加しました")
        
        # 既存のユーザーをすべて 'male' に設定（すでにDEFAULT値で設定済み）
        result = db.execute_sql('UPDATE users SET gender = "male" WHERE gender IS NULL')
        print(f"✓ 既存ユーザーの性別を設定しました")
        
        print("✓ マイグレーション完了")
        
    except Exception as e:
        print(f"✗ エラー: {e}")
        print("カラムが既に存在する可能性があります")
    
    finally:
        db.close()

if __name__ == '__main__':
    migrate()
