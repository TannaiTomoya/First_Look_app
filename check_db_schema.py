#!/usr/bin/env python3
"""
データベーススキーマ確認スクリプト
Render環境でテーブルとカラムの存在を確認
"""
import sqlite3
import os

# データベースパス
db_path = os.getenv('DATABASE_PATH', '/data/firstlook.db')

if not os.path.exists(db_path):
    print(f"❌ データベースが見つかりません: {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("=" * 60)
print("📊 データベーススキーマチェック")
print("=" * 60)

# 1. テーブル一覧
print("\n【テーブル一覧】")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()
for table in tables:
    print(f"  ✓ {table[0]}")

# 2. look_recordsテーブルの確認
print("\n【look_recordsテーブル】")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='look_records'")
if cursor.fetchone():
    cursor.execute("PRAGMA table_info(look_records)")
    columns = cursor.fetchall()
    print("  カラム:")
    for col in columns:
        print(f"    - {col[1]} ({col[2]})")
else:
    print("  ❌ テーブルが存在しません")

# 3. daily_actionsテーブルの確認
print("\n【daily_actionsテーブル】")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_actions'")
if cursor.fetchone():
    cursor.execute("PRAGMA table_info(daily_actions)")
    columns = cursor.fetchall()
    print("  カラム:")
    for col in columns:
        print(f"    - {col[1]} ({col[2]})")
else:
    print("  ❌ テーブルが存在しません")

# 4. schema_migrationsテーブルの確認
print("\n【適用済みマイグレーション】")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
if cursor.fetchone():
    cursor.execute("SELECT * FROM schema_migrations ORDER BY applied_at")
    migrations = cursor.fetchall()
    for mig in migrations:
        print(f"  ✓ {mig[1]} (適用日時: {mig[2]})")
else:
    print("  ❌ schema_migrationsテーブルが存在しません")

conn.close()
print("\n" + "=" * 60)
