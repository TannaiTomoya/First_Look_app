"""
初期マイグレーション - 全テーブル作成

FirstLook アプリケーションの全14テーブルを作成します。

重要: SQLiteの外部キー制約に対応するため、参照される側のテーブルを先に作成します。
DeferredForeignKeyを使用していても、CREATE TABLE時には参照先が必要です。

テーブル一覧（作成順序）:
1. desired_faces - 印象カード（参照されるマスタ）
2. users - ユーザーアカウント（DesiredFaceを参照）
3. coaches - コーチプロフィール（Userを参照）
4. menus - コーチメニュー（Coachを参照）
5. photos - 写真（Userを参照、多数から参照される）
6. skin_checks - 肌診断（Userを参照）
7. daily_checks - 5分チェック（Userを参照）
8. face_templates - 顔ベース画像（User, DesiredFaceを参照）
9. face_parts - 顔パーツ（参照されるマスタ）
10. face_compositions - パーツ合成（User, FaceTemplate, FacePartを参照）
11. bookings - 予約管理（User, Menuを参照）
12. chats - チャットルーム（Bookingを参照）
13. messages - メッセージ（Chat, Userを参照）
14. before_after_posts - Before/After投稿（User, Photo, DesiredFaceを参照）
"""

import models


def apply(db):
    """
    初回スキーマ作成
    
    SQLiteは参照先テーブルが先に必要なので「順序」が重要。
    DeferredForeignKeyでも、CREATE TABLE時に参照先が必要になるケースがある。
    
    Args:
        db: Peeweeデータベースインスタンス
    """
    
    # 参照される側から順に作る（外部キー制約準拠）
    ordered_models = [
        # マスタ / 参照されがち
        models.DesiredFace,
        
        # ユーザー系（DesiredFace を参照）
        models.User,
        models.Coach,  # User -> Coach
        
        # コーチ業務
        models.Menu,   # Coach -> Menu
        
        # 汎用写真（後で多数から参照）
        models.Photo,  # User -> Photo
        
        # 診断・日次
        models.SkinCheck,   # User -> SkinCheck
        models.DailyCheck,  # User -> DailyCheck
        
        # 顔テンプレ系（DesiredFace/User を参照）
        models.FaceTemplate,     # User, DesiredFace
        models.FacePart,         # パーツマスタ
        models.FaceComposition,  # Template, Parts, User
        
        # 予約〜チャット（依存が深い）
        models.Booking,  # User(client), Menu
        models.Chat,     # Booking
        models.Message,  # Chat, User(sender)
        
        # Before/After（Photo/DesiredFace/User に依存）
        models.BeforeAfterPost,
    ]
    
    # safe=True で既存テーブルは無視（冪等性保証）
    db.create_tables(ordered_models, safe=True)
    
    print("  ✅ 全14テーブル作成完了（外部キー制約準拠）")
    print(f"     - desired_faces, users, coaches, menus")
    print(f"     - photos, skin_checks, daily_checks")
    print(f"     - face_templates, face_parts, face_compositions")
    print(f"     - bookings, chats, messages")
    print(f"     - before_after_posts")
