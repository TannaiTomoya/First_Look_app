#!/usr/bin/env python
"""
⚠️ 【使用禁止】旧形式マイグレーション - 参考用のみ ⚠️

このファイルは参考用として保持されています。
今後のスキーマ変更は migrations/ ディレクトリに追加してください。

詳細: MIGRATIONS_README.md を参照

---

SkinCheckモデルにAI診断結果カラムを追加するマイグレーション

追加カラム:
- ai_analyzed: AI診断済みフラグ
- ai_score: AIスコア（0-100）
- ai_skin_age: AI推定肌年齢
- ai_general_advice: 一般向けアドバイス
- ai_expert_advice: 専門家向けアドバイス
"""
from models import db

def migrate():
    """AI診断結果カラムをskin_checksテーブルに追加"""
    print("マイグレーション開始: AI診断結果カラム追加")
    
    db.connect()
    
    try:
        # 各カラムを追加
        columns_to_add = [
            ('ai_analyzed', 'INTEGER DEFAULT 0'),
            ('ai_score', 'INTEGER NULL'),
            ('ai_skin_age', 'INTEGER NULL'),
            ('ai_general_advice', 'TEXT NULL'),
            ('ai_expert_advice', 'TEXT NULL')
        ]
        
        for column_name, column_def in columns_to_add:
            try:
                db.execute_sql(f'ALTER TABLE skin_checks ADD COLUMN {column_name} {column_def}')
                print(f"✓ {column_name} カラムを追加しました")
            except Exception as e:
                if 'duplicate column name' in str(e).lower():
                    print(f"  {column_name} カラムは既に存在します（スキップ）")
                else:
                    raise e
        
        print("✓ マイグレーション完了")
        
    except Exception as e:
        print(f"✗ エラー: {e}")
    
    finally:
        db.close()

if __name__ == '__main__':
    migrate()
