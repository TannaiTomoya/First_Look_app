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


def auto_seed_master_data():
    """
    マスターデータが空の場合、自動で投入
    """
    try:
        from models.impression import DesiredFace
        from models.face_template import FacePart
        
        desired_face_count = DesiredFace.select().count()
        face_part_count = FacePart.select().count()
        
        if desired_face_count == 0 or face_part_count == 0:
            print("\n" + "=" * 60)
            print("🌱 マスターデータ自動投入")
            print("=" * 60)
            
            # 印象カードの投入
            if desired_face_count == 0:
                print("印象カードを作成中...")
                faces = [
                    ("知的", "images/impressions/intelligent_face.jpg", "知的で落ち着いた印象"),
                    ("清潔感", "images/impressions/clean_face.jpg", "清潔感があり好印象"),
                    ("自信", "images/impressions/confident_face.jpg", "自信に満ちた印象"),
                    ("優しい", "images/impressions/gentle_face.jpg", "優しく温かい印象"),
                ]
                for label, image, desc in faces:
                    DesiredFace.create(label=label, image_url=image, description=desc)
                print(f"✓ {DesiredFace.select().count()}件の印象カードを作成")
            
            # 顔パーツの投入
            if face_part_count == 0:
                print("顔パーツを作成中...")
                
                # 眉パーツ
                eyebrow_parts = [
                    ("自然な眉", "images/face_parts/eyebrows/eyebrow_1.png"),
                    ("柔らかい眉1", "images/face_parts/eyebrows/eyebrow_2.png"),
                    ("柔らかい眉2", "images/face_parts/eyebrows/eyebrow_3.png"),
                    ("しっかりした眉", "images/face_parts/eyebrows/eyebrow_4.png"),
                ]
                for label, image_path in eyebrow_parts:
                    FacePart.create(
                        part_type='eyebrow',
                        label=label,
                        image_url=image_path,
                        position_x=50,
                        position_y=30,
                        scale=1.0
                    )
                
                # 鼻パーツ
                nose_parts = [
                    ("すっきり鼻", "images/face_parts/noses/nose_1.png"),
                    ("丸みのある鼻", "images/face_parts/noses/nose_2.png"),
                    ("高い鼻筋", "images/face_parts/noses/nose_3.png"),
                ]
                for label, image_path in nose_parts:
                    FacePart.create(
                        part_type='nose',
                        label=label,
                        image_url=image_path,
                        position_x=50,
                        position_y=50,
                        scale=1.0
                    )
                
                print(f"✓ {FacePart.select().count()}件の顔パーツを作成")
            
            print("=" * 60)
            print("✅ マスターデータ投入完了")
            print("=" * 60)
        else:
            print(f"\n✓ マスターデータは既に存在（印象: {desired_face_count}件, パーツ: {face_part_count}件）")
    
    except Exception as e:
        print(f"⚠️  マスターデータ投入でエラー: {e}")
        print("   手動で実行してください: python db_manager.py seed")


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
    
    # マスターデータの自動投入チェック
    auto_seed_master_data()


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
