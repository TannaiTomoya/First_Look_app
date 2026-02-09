#!/usr/bin/env python
"""
マイグレーションランナー - FirstLook

使用方法:
    python scripts/migrate.py status  - マイグレーション状態確認
    python scripts/migrate.py up      - 未適用マイグレーションを実行

マイグレーションファイルの命名規則:
    migrations/0001_description.py
    migrations/0002_another.py
    ...

各マイグレーションファイルには apply(db) 関数を実装すること。
"""
import os
import re
import sys
import importlib
from datetime import datetime
from peewee import Model, CharField, DateTimeField

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# DB設定をインポート
from models.db import db

# models を import して DeferredForeignKey を解決させる（重要）
import models  # noqa: F401

# マイグレーションディレクトリ
MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "migrations")

# マイグレーションファイル名の正規表現（0001_*.py 形式）
MIGRATION_RE = re.compile(r"^\d{4}_.+\.py$")


class BaseModel(Model):
    """マイグレーション管理用ベースモデル"""
    class Meta:
        database = db


class SchemaMigration(BaseModel):
    """
    適用済みマイグレーション履歴
    
    各マイグレーションの適用状態を記録します。
    """
    name = CharField(unique=True)  # マイグレーションファイル名
    applied_at = DateTimeField(default=datetime.utcnow)  # 適用日時
    
    class Meta:
        table_name = 'schema_migrations'


def list_migration_files():
    """
    migrationsディレクトリ内のマイグレーションファイル一覧を取得
    
    Returns:
        list: ソート済みのマイグレーションファイル名リスト
    """
    files = []
    for f in os.listdir(MIGRATIONS_DIR):
        if MIGRATION_RE.match(f) and f != "__init__.py":
            files.append(f)
    return sorted(files)


def ensure_schema_migrations():
    """
    schema_migrationsテーブルを作成（存在しない場合）
    
    冪等性を保証するため、safe=True で作成します。
    """
    db.connect(reuse_if_open=True)
    db.create_tables([SchemaMigration], safe=True)


def cmd_status():
    """
    マイグレーション状態を表示
    
    各マイグレーションファイルの適用状態を ✅/⬜ で表示します。
    """
    ensure_schema_migrations()
    
    # 適用済みマイグレーション一覧
    applied = set([row[0] for row in SchemaMigration.select(SchemaMigration.name).tuples()])
    
    print("=" * 60)
    print("📊 マイグレーション状態")
    print("=" * 60)
    
    migration_files = list_migration_files()
    
    if not migration_files:
        print("\n⚠️  マイグレーションファイルがありません")
        print("=" * 60)
        return
    
    for f in migration_files:
        mark = "✅" if f in applied else "⬜"
        print(f"{mark} {f}")
    
    # サマリー
    applied_count = len([f for f in migration_files if f in applied])
    pending_count = len(migration_files) - applied_count
    
    print("=" * 60)
    print(f"適用済み: {applied_count} / 未適用: {pending_count} / 合計: {len(migration_files)}")
    print("=" * 60)


def cmd_up():
    """
    未適用マイグレーションを実行
    
    migrations/ ディレクトリ内の未適用マイグレーションを
    ファイル名の昇順で順次実行します。
    """
    ensure_schema_migrations()
    
    # 適用済みマイグレーション一覧
    applied = set([row[0] for row in SchemaMigration.select(SchemaMigration.name).tuples()])
    
    migration_files = list_migration_files()
    pending = [f for f in migration_files if f not in applied]
    
    if not pending:
        print("✅ 適用するマイグレーションはありません")
        return
    
    print(f"🚀 {len(pending)} 件のマイグレーションを適用します...\n")
    
    for f in pending:
        # マイグレーションモジュールをインポート
        mod_name = f"migrations.{f[:-3]}"
        
        try:
            mod = importlib.import_module(mod_name)
        except ImportError as e:
            print(f"❌ {f} のインポートに失敗: {e}")
            raise
        
        # apply()関数の存在確認
        if not hasattr(mod, "apply"):
            raise RuntimeError(f"❌ {f} に apply() 関数がありません")
        
        print(f"==> applying {f}")
        
        # トランザクション内でマイグレーション実行
        try:
            with db.atomic():
                mod.apply(db)
                SchemaMigration.create(name=f)
        except Exception as e:
            print(f"❌ {f} の適用に失敗: {e}")
            raise
    
    print("\n✅ DONE - 全マイグレーション適用完了")


def main():
    """
    メインエントリーポイント
    """
    if len(sys.argv) < 2:
        print("使用方法:")
        print("  python scripts/migrate.py status  - マイグレーション状態確認")
        print("  python scripts/migrate.py up      - 未適用マイグレーションを実行")
        sys.exit(1)
    
    cmd = sys.argv[1].lower()
    
    try:
        if cmd == "status":
            cmd_status()
        elif cmd == "up":
            cmd_up()
        else:
            print(f"❌ 不明なコマンド: {cmd}")
            print("\n使用可能なコマンド: status, up")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        # データベース接続を閉じる
        if not db.is_closed():
            db.close()


if __name__ == "__main__":
    main()
