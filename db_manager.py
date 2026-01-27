#!/usr/bin/env python
"""
データベース管理スクリプト

database.mdc仕様に基づいたデータベース初期化・管理ツール

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
from models import db, User, Post, Like, Comment, Follow

def init_db():
    """データベースを初期化（接続とテーブル作成）"""
    # instanceディレクトリが存在しない場合は作成
    os.makedirs('instance', exist_ok=True)
    
    print("データベースを初期化中...")
    print("  - データベースに接続")
    db.connect()
    
    print("  - テーブル作成")
    db.create_tables([User, Post, Like, Comment, Follow], safe=True)
    
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
    os.makedirs('instance', exist_ok=True)
    
    print("データベースに接続中...")
    db.connect()
    
    print("テーブルを作成中...")
    db.create_tables([User, Post, Like, Comment, Follow], safe=True)
    
    print("✓ テーブル作成完了")
    db.close()

def drop_tables():
    """全テーブルを削除"""
    print("データベースに接続中...")
    db.connect()
    
    print("テーブルを削除中...")
    db.drop_tables([User, Post, Like, Comment, Follow], safe=True)
    
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
    print(f"  posts: {Post.select().count()}")
    print(f"  likes: {Like.select().count()}")
    print(f"  comments: {Comment.select().count()}")
    print(f"  follows: {Follow.select().count()}")
    
    db.close()

def show_database_info():
    """データベース詳細情報を表示"""
    db.connect()
    
    print("\n" + "="*50)
    print("データベース詳細情報")
    print("="*50)
    
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
    post_count = Post.select().count()
    like_count = Like.select().count()
    comment_count = Comment.select().count()
    follow_count = Follow.select().count()
    
    print(f"  ユーザー数: {user_count}")
    print(f"  投稿数: {post_count}")
    print(f"  いいね数: {like_count}")
    print(f"  コメント数: {comment_count}")
    print(f"  フォロー関係数: {follow_count}")
    
    # アクティブユーザー情報
    if user_count > 0:
        print("\n【ユーザー一覧】")
        for user in User.select().order_by(User.created_at.desc()).limit(10):
            user_posts = Post.select().where(Post.user == user).count()
            user_likes = Like.select().where(Like.user == user).count()
            print(f"  - {user.username} ({user.email})")
            print(f"    投稿: {user_posts}件 | いいね: {user_likes}件")
    
    # 最新投稿
    if post_count > 0:
        print("\n【最新投稿】")
        for post in Post.select().order_by(Post.created_at.desc()).limit(5):
            # DeferredForeignKeyのため、user_idから直接Userを取得
            user = User.get_by_id(post.user)
            post_likes = Like.select().where(Like.post == post).count()
            post_comments = Comment.select().where(Comment.post == post).count()
            caption = post.caption[:30] + "..." if post.caption and len(post.caption) > 30 else post.caption
            print(f"  - @{user.username}: {caption or '(キャプションなし)'}")
            print(f"    いいね: {post_likes} | コメント: {post_comments}")
    
    print("\n" + "="*50 + "\n")
    db.close()

def seed_data():
    """テストデータを投入"""
    db.connect()
    
    print("テストデータを作成中...")
    
    # ユーザー作成
    from werkzeug.security import generate_password_hash
    
    user1 = User.create(
        username='tanaka',
        email='tanaka@example.com',
        password_hash=generate_password_hash('password123'),
        profile_image='default.jpg',
        bio='こんにちは！写真が好きです。'
    )
    
    user2 = User.create(
        username='suzuki',
        email='suzuki@example.com',
        password_hash=generate_password_hash('password123'),
        profile_image='default.jpg',
        bio='旅行の写真をシェアしています。'
    )
    
    user3 = User.create(
        username='sato',
        email='sato@example.com',
        password_hash=generate_password_hash('password123'),
        profile_image='default.jpg',
        bio='カメラ初心者です！'
    )
    
    print(f"✓ {User.select().count()}人のユーザーを作成")
    
    # 投稿作成
    post1 = Post.create(
        user=user1,
        image_file='photo1.jpg',
        caption='今日の夕焼けが綺麗でした'
    )
    
    post2 = Post.create(
        user=user2,
        image_file='photo2.jpg',
        caption='京都旅行 #travel'
    )
    
    post3 = Post.create(
        user=user1,
        image_file='photo3.jpg',
        caption='朝のコーヒー☕'
    )
    
    print(f"✓ {Post.select().count()}件の投稿を作成")
    
    # いいね作成
    Like.create(user=user2, post=post1)
    Like.create(user=user3, post=post1)
    Like.create(user=user1, post=post2)
    
    print(f"✓ {Like.select().count()}件のいいねを作成")
    
    # コメント作成
    Comment.create(user=user2, post=post1, content='素敵な写真ですね！')
    Comment.create(user=user3, post=post1, content='いいね👍')
    Comment.create(user=user1, post=post2, content='京都行きたい！')
    
    print(f"✓ {Comment.select().count()}件のコメントを作成")
    
    # フォロー関係作成
    Follow.create(follower=user1, followed=user2)
    Follow.create(follower=user1, followed=user3)
    Follow.create(follower=user2, followed=user1)
    Follow.create(follower=user3, followed=user1)
    
    print(f"✓ {Follow.select().count()}件のフォロー関係を作成")
    
    print("\n✓ テストデータ投入完了")
    db.close()

def print_help():
    """ヘルプメッセージを表示"""
    print("\n" + "="*60)
    print("データベース管理スクリプト (database.mdc準拠)")
    print("="*60)
    print("\n【使用方法】")
    print("  python db_manager.py <コマンド>\n")
    print("【コマンド一覧】")
    print("  init      - データベース初期化")
    print("              接続とテーブル作成を一括実行")
    print()
    print("  create    - テーブル作成")
    print("              全てのテーブルを作成します")
    print("              (users, posts, likes, comments, follows)")
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
    print("              サンプルユーザー・投稿・いいね等を作成します")
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
    print("="*60 + "\n")

def main():
    """コマンドライン引数に応じて処理を実行"""
    if len(sys.argv) < 2:
        print_help()
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    # ヘルプ表示
    if command in ['help', '-h', '--help', '?']:
        print_help()
        return
    
    # コマンド実行
    try:
        if command == 'init':
            init_db()
            close_db()
        elif command == 'create':
            create_tables()
        elif command == 'close':
            close_db()
        elif command == 'drop':
            # 確認プロンプト
            response = input("警告: 全てのデータが削除されます。続行しますか? (yes/no): ")
            if response.lower() in ['yes', 'y']:
                drop_tables()
            else:
                print("キャンセルされました")
        elif command == 'reset':
            # 確認プロンプト
            response = input("警告: 全てのデータが削除されます。続行しますか? (yes/no): ")
            if response.lower() in ['yes', 'y']:
                reset_tables()
            else:
                print("キャンセルされました")
        elif command == 'show':
            show_tables()
        elif command == 'seed':
            seed_data()
        elif command == 'info':
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

if __name__ == '__main__':
    main()
