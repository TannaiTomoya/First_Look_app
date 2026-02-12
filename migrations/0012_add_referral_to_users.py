"""
マイグレーション: Userテーブルにreferral関連カラムを追加
"""


def apply(db):
    """マイグレーション適用"""
    # カラムが既に存在する場合はスキップ（冪等性）
    cursor = db.execute_sql("PRAGMA table_info(users)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    
    if 'referral_code' not in existing_columns:
        db.execute_sql("""
            ALTER TABLE users 
            ADD COLUMN referral_code VARCHAR(16) DEFAULT NULL
        """)
        print("✓ usersテーブルにreferral_codeカラムを追加")
    else:
        print("⊘ referral_codeカラムは既に存在（スキップ）")
    
    if 'referred_by_id' not in existing_columns:
        db.execute_sql("""
            ALTER TABLE users 
            ADD COLUMN referred_by_id INTEGER DEFAULT NULL
        """)
        print("✓ usersテーブルにreferred_by_idカラムを追加")
    else:
        print("⊘ referred_by_idカラムは既に存在（スキップ）")
    
    # UNIQUE indexを作成（IF NOT EXISTSで冪等）
    db.execute_sql("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code 
        ON users(referral_code) 
        WHERE referral_code IS NOT NULL
    """)


def rollback(db):
    """マイグレーション取り消し"""
    db.execute_sql("ALTER TABLE users DROP COLUMN referral_code")
    db.execute_sql("ALTER TABLE users DROP COLUMN referred_by_id")
    print("✓ usersテーブルからreferral_code, referred_by_idカラムを削除")
