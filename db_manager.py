#!/usr/bin/env python
"""
データベース管理スクリプト - FirstLook

FirstLook要件定義書に基づいたデータベース初期化・管理ツール

使用方法:
    python db_manager.py init      - データベース初期化
    python db_manager.py create    - テーブル作成
    python db_manager.py drop      - テーブル削除
    python db_manager.py reset     - テーブルリセット
    python db_manager.py show      - テーブル一覧表示
    python db_manager.py seed      - テストデータ投入
    python db_manager.py info      - データベース詳細情報表示
    python db_manager.py close     - データベース接続を閉じる
"""
import os
import sys
from datetime import datetime

# modelsパッケージから必要なものをインポート
from models import (
    db,
    User,
    Coach,
    Menu,
    DesiredFace,
    SkinCheck,
    Booking,
    Chat,
    Message,
    DailyCheck,
    Photo,
    BeforeAfterPost,
)


def init_db():
    """データベースを初期化（接続とテーブル作成）"""
    # instanceディレクトリが存在しない場合は作成
    os.makedirs("instance", exist_ok=True)

    print("データベースを初期化中...")
    print("  - データベースに接続")
    db.connect()

    print("  - テーブル作成")
    # 依存関係を考慮した順序でテーブル作成（FirstLook専用）
    tables = [
        User,
        Coach,
        Menu,
        DesiredFace,
        SkinCheck,
        Booking,
        Chat,
        Message,
        DailyCheck,
        Photo,
        BeforeAfterPost,
    ]
    db.create_tables(tables, safe=True)

    print("✓ データベース初期化完了")
    return db


def close_db():
    """データベース接続を閉じる"""
    if not db.is_closed():
        db.close()
        print("✓ データベース接続を閉じました")
    else:
        print("データベースは既に閉じられています")


def create_tables():
    """全テーブルを作成"""
    # instanceディレクトリが存在しない場合は作成
    os.makedirs("instance", exist_ok=True)

    print("データベースに接続中...")
    db.connect()

    print("テーブルを作成中...")
    # 依存関係を考慮した順序でテーブル作成（FirstLook専用）
    tables = [
        User,
        Coach,
        Menu,
        DesiredFace,
        SkinCheck,
        Booking,
        Chat,
        Message,
        DailyCheck,
        Photo,
        BeforeAfterPost,
    ]
    db.create_tables(tables, safe=True)

    print("✓ テーブル作成完了")
    db.close()


def drop_tables():
    """全テーブルを削除"""
    print("データベースに接続中...")
    db.connect()

    print("テーブルを削除中...")
    # 依存関係の逆順で削除（FirstLook専用）
    tables = [
        BeforeAfterPost,
        Photo,
        DailyCheck,
        Message,
        Chat,
        Booking,
        SkinCheck,
        DesiredFace,
        Menu,
        Coach,
        User,
    ]
    db.drop_tables(tables, safe=True)

    print("✓ テーブル削除完了")
    db.close()


def reset_tables():
    """全テーブルを削除して再作成"""
    print("データベースをリセット中...")
    drop_tables()
    create_tables()
    print("✓ データベースリセット完了")


def show_tables():
    """テーブル一覧を表示"""
    db.connect()

    print("\n=== テーブル一覧 ===")
    tables = db.get_tables()
    for table in tables:
        print(f"  - {table}")

    print("\n=== レコード数 ===")
    print(f"  users: {User.select().count()}")
    print(f"  coaches: {Coach.select().count()}")
    print(f"  menus: {Menu.select().count()}")
    print(f"  desired_faces: {DesiredFace.select().count()}")
    print(f"  skin_checks: {SkinCheck.select().count()}")
    print(f"  bookings: {Booking.select().count()}")
    print(f"  chats: {Chat.select().count()}")
    print(f"  messages: {Message.select().count()}")
    print(f"  daily_checks: {DailyCheck.select().count()}")
    print(f"  photos: {Photo.select().count()}")
    print(f"  before_after_posts: {BeforeAfterPost.select().count()}")

    db.close()


def show_database_info():
    """データベース詳細情報を表示"""
    db.connect()

    print("\n" + "=" * 50)
    print("データベース詳細情報")
    print("=" * 50)

    # データベース基本情報
    print("\n【データベース概要】")
    print(f"  DBMS: SQLite")
    print(f"  ファイル: {db.database}")
    print(f"  文字コード: UTF-8")

    # テーブル情報
    print("\n【テーブル構成】")
    tables = db.get_tables()
    print(f"  テーブル数: {len(tables)}")
    for table in tables:
        print(f"    - {table}")

    # レコード統計
    print("\n【データ統計】")
    user_count = User.select().count()
    coach_count = Coach.select().count()
    booking_count = Booking.select().count()
    before_after_count = BeforeAfterPost.select().count()

    print(f"  ユーザー数: {user_count}")
    print(f"  コーチ数: {coach_count}")
    print(f"  予約数: {booking_count}")
    print(f"  Before/After投稿数: {before_after_count}")

    # アクティブユーザー情報
    if user_count > 0:
        print("\n【ユーザー一覧】")
        for user in User.select().order_by(User.created_at.desc()).limit(10):
            role_label = "コーチ" if user.role == "coach" else "クライアント"
            print(f"  - {user.username} ({user.email}) - {role_label}")

    # 最新Before/After投稿
    if before_after_count > 0:
        print("\n【最新Before/After投稿】")
        for post in BeforeAfterPost.select().order_by(BeforeAfterPost.created_at.desc()).limit(5):
            user = User.get_by_id(post.user)
            caption = post.caption[:30] + "..." if post.caption and len(post.caption) > 30 else post.caption
            print(f"  - @{user.username}: {caption or '(キャプションなし)'}")

    print("\n" + "=" * 50 + "\n")
    db.close()


def seed_data():
    """テストデータを投入"""
    db.connect()

    print("テストデータを作成中...")

    # ユーザー作成
    from werkzeug.security import generate_password_hash
    from datetime import datetime, timedelta

    # クライアント作成
    client1 = User.create(
        username="tanaka_client",
        email="client1@example.com",
        password_hash=generate_password_hash("password123"),
        profile_image="default.jpg",
        bio="来週大事な面接があります",
        role="client",
        gender="male"
    )

    client2 = User.create(
        username="yamada_client",
        email="client2@example.com",
        password_hash=generate_password_hash("password123"),
        profile_image="default.jpg",
        bio="婚活パーティーに参加予定",
        role="client",
        gender="female"
    )

    # コーチ作成
    coach1_user = User.create(
        username="suzuki_coach",
        email="coach1@example.com",
        password_hash=generate_password_hash("password123"),
        profile_image="default.jpg",
        bio="第一印象コンサルタント",
        role="coach",
        gender="male"
    )

    coach2_user = User.create(
        username="sato_coach",
        email="coach2@example.com",
        password_hash=generate_password_hash("password123"),
        profile_image="default.jpg",
        bio="メイクアップアーティスト",
        role="coach",
        gender="female"
    )

    print(f"✓ {User.select().count()}人のユーザーを作成（Client: 2人, Coach: 2人）")

    # コーチプロフィール作成
    coach1 = Coach.create(
        user=coach1_user,
        bio="10年以上のキャリアを持つ第一印象コンサルタント。ビジネスシーンに特化。",
        expertise="眉整え、表情指導、ビジネスマナー",
        area="東京都内",
        price_range="¥5,000-¥15,000",
    )

    coach2 = Coach.create(
        user=coach2_user,
        bio="メイクアップアーティストとして活動。婚活・デート向けが得意。",
        expertise="メイク、スキンケア、ファッション",
        area="大阪府内",
        price_range="¥8,000-¥20,000",
    )

    print(f"✓ {Coach.select().count()}人のコーチプロフィールを作成")

    # メニュー作成
    menu1 = Menu.create(
        coach=coach1,
        title="面接対策プラン",
        description="面接前の印象チェック。眉・表情・姿勢を改善します。",
        price=8000,
        duration=60,
    )

    menu2 = Menu.create(
        coach=coach1,
        title="ビジネス商談プラン",
        description="商談前の準備。清潔感と信頼感のある印象作り。",
        price=12000,
        duration=90,
    )

    menu3 = Menu.create(
        coach=coach2,
        title="婚活メイクプラン",
        description="婚活パーティー向けのナチュラルメイク指導。",
        price=10000,
        duration=90,
    )

    menu4 = Menu.create(
        coach=coach2,
        title="デート前クイックプラン",
        description="デート前30分の集中ケア。",
        price=5000,
        duration=30,
    )

    print(f"✓ {Menu.select().count()}件のメニューを作成")

    # 印象カード作成
    faces = [
        ("知的", "images/impressions/intelligent_face.jpg", "知的で信頼できる印象"),
        ("親しみやすい", "images/impressions/friendly_face.jpg", "親しみやすく話しかけやすい印象"),
        ("清潔感", "images/impressions/clean_face.jpg", "清潔感があり好印象"),
        ("自信", "images/impressions/confident_face.jpg", "自信に満ちた印象"),
        ("優しい", "images/impressions/gentle_face.jpg", "優しく温かい印象"),
    ]

    for label, image, desc in faces:
        DesiredFace.create(label=label, image_url=image, description=desc)

    print(f"✓ {DesiredFace.select().count()}件の印象カードを作成")

    # 肌診断作成
    SkinCheck.create(user=client1, skin_type="combination", concerns="pores,tone")

    SkinCheck.create(user=client2, skin_type="dry", concerns="dark_spots,acne")

    print(f"✓ {SkinCheck.select().count()}件の肌診断を作成")

    # 予約作成
    booking1 = Booking.create(
        client=client1,
        menu=menu1,
        booking_datetime=datetime.now() + timedelta(days=3),
        status="confirmed",
        notes="よろしくお願いします",
    )

    # チャット自動生成
    chat1 = Chat.create(booking=booking1)

    # メッセージ作成
    Message.create(chat=chat1, sender=client1, content="来週の面接に向けて、よろしくお願いします！")

    Message.create(
        chat=chat1, sender=coach1_user, content="承知しました！しっかりサポートさせていただきます。"
    )

    print(f"✓ {Booking.select().count()}件の予約を作成")
    print(f"✓ {Chat.select().count()}件のチャットを作成")
    print(f"✓ {Message.select().count()}件のメッセージを作成")

    print("\n✓ テストデータ投入完了")
    db.close()


def print_help():
    """ヘルプメッセージを表示"""
    print("\n" + "=" * 60)
    print("データベース管理スクリプト (database.mdc準拠)")
    print("=" * 60)
    print("\n【使用方法】")
    print("  python db_manager.py <コマンド>\n")
    print("【コマンド一覧】")
    print("  init      - データベース初期化")
    print("              接続とテーブル作成を一括実行")
    print()
    print("  create    - テーブル作成")
    print("              全てのテーブルを作成します")
    print("              (users, posts)")
    print()
    print("  drop      - テーブル削除")
    print("              警告: 全てのデータが削除されます")
    print()
    print("  reset     - テーブルリセット")
    print("              全テーブルを削除して再作成します")
    print()
    print("  show      - テーブル一覧表示")
    print("              テーブル名とレコード数を表示します")
    print()
    print("  seed      - テストデータ投入")
    print("              サンプルユーザー・投稿を作成します")
    print()
    print("  info      - データベース詳細情報")
    print("              データベースの詳細な統計情報を表示します")
    print()
    print("  close     - データベース接続を閉じる")
    print("              明示的に接続を終了します")
    print()
    print("【使用例】")
    print("  # 初回セットアップ")
    print("  python db_manager.py init")
    print("  python db_manager.py seed")
    print()
    print("  # 開発中のリセット")
    print("  python db_manager.py reset")
    print("  python db_manager.py seed")
    print()
    print("=" * 60 + "\n")


def main():
    """コマンドライン引数に応じて処理を実行"""
    if len(sys.argv) < 2:
        print_help()
        sys.exit(1)

    command = sys.argv[1].lower()

    # ヘルプ表示
    if command in ["help", "-h", "--help", "?"]:
        print_help()
        return

    # コマンド実行
    try:
        if command == "init":
            init_db()
            close_db()
        elif command == "create":
            create_tables()
        elif command == "close":
            close_db()
        elif command == "drop":
            # 確認プロンプト
            response = input("警告: 全てのデータが削除されます。続行しますか? (yes/no): ")
            if response.lower() in ["yes", "y"]:
                drop_tables()
            else:
                print("キャンセルされました")
        elif command == "reset":
            # 確認プロンプト
            response = input("警告: 全てのデータが削除されます。続行しますか? (yes/no): ")
            if response.lower() in ["yes", "y"]:
                reset_tables()
            else:
                print("キャンセルされました")
        elif command == "show":
            show_tables()
        elif command == "seed":
            seed_data()
        elif command == "info":
            show_database_info()
        else:
            print(f"エラー: 不明なコマンド '{command}'")
            print("ヘルプを表示するには: python db_manager.py help")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n中断されました")
        sys.exit(0)
    except Exception as e:
        print(f"\nエラーが発生しました: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
