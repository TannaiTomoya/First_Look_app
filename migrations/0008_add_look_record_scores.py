"""
マイグレーション: look_recordsにスコアカラム追加
Phase B: AIコーチ判定機能
"""


def apply(db):
    """スコアカラム追加"""
    # 総合スコア
    db.execute_sql('''
        ALTER TABLE look_records
        ADD COLUMN score_total INTEGER DEFAULT NULL
    ''')

    # 輪郭シャープ度
    db.execute_sql('''
        ALTER TABLE look_records
        ADD COLUMN score_contour INTEGER DEFAULT NULL
    ''')

    # 肌の整い度
    db.execute_sql('''
        ALTER TABLE look_records
        ADD COLUMN score_skin INTEGER DEFAULT NULL
    ''')

    # 若見え度
    db.execute_sql('''
        ALTER TABLE look_records
        ADD COLUMN score_young INTEGER DEFAULT NULL
    ''')

    # 前回比
    db.execute_sql('''
        ALTER TABLE look_records
        ADD COLUMN score_diff INTEGER DEFAULT NULL
    ''')

    print('✓ look_recordsにスコアカラム追加完了（score_total/contour/skin/young/diff）')
