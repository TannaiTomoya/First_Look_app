"""
マイグレーション: Userテーブルにreferral関連カラムを追加
"""


def apply(db):
    """マイグレーション適用"""
    # まずカラムを追加（UNIQUE制約なし）
    db.execute_sql("""
        ALTER TABLE users 
        ADD COLUMN referral_code VARCHAR(16) DEFAULT NULL
    """)
    
    db.execute_sql("""
        ALTER TABLE users 
        ADD COLUMN referred_by_id INTEGER DEFAULT NULL
    """)
    
    # UNIQUE indexを作成
    db.execute_sql("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code 
        ON users(referral_code) 
        WHERE referral_code IS NOT NULL
    """)
    
    print("✓ usersテーブルにreferral_code, referred_by_idカラムを追加")


def rollback(db):
    """マイグレーション取り消し"""
    db.execute_sql("ALTER TABLE users DROP COLUMN referral_code")
    db.execute_sql("ALTER TABLE users DROP COLUMN referred_by_id")
    print("✓ usersテーブルからreferral_code, referred_by_idカラムを削除")
