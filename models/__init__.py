"""
データベースモデルパッケージ
"""
from peewee import SqliteDatabase, Model

# データベースインスタンス
db = SqliteDatabase('instance/photoapp.db')

class BaseModel(Model):
    """全モデルの基底クラス"""
    class Meta:
        database = db

# モデルのインポート（DeferredForeignKeyを使用しているため順序は自由）
from models.user import User
from models.post import Post
from models.like import Like
from models.comment import Comment
from models.follow import Follow

# ヘルパー関数のインポート
from models.post import get_timeline_posts, get_explore_posts

__all__ = [
    'db',
    'BaseModel',
    'User',
    'Post',
    'Like',
    'Comment',
    'Follow',
    'get_timeline_posts',
    'get_explore_posts',
]
