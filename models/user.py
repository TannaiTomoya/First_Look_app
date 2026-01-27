"""
ユーザーモデル
"""
from peewee import AutoField, CharField, TextField, DateTimeField
from flask_login import UserMixin
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from models import BaseModel


class User(BaseModel, UserMixin):
    """ユーザーアカウント情報を管理"""
    id = AutoField(primary_key=True)
    username = CharField(max_length=50, unique=True)
    email = CharField(max_length=120, unique=True)
    password_hash = CharField(max_length=255)
    profile_image = CharField(max_length=255, default='default.jpg')
    bio = TextField(null=True)
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'users'
        indexes = (
            (('username',), True),
            (('email',), True),
        )
    
    def set_password(self, password):
        """パスワードをハッシュ化して保存"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """パスワードの検証"""
        return check_password_hash(self.password_hash, password)
    
    def post_count(self):
        """投稿数を取得"""
        return self.posts.count()
    
    def following_count(self):
        """フォロー中の数を取得"""
        from models.follow import Follow
        return Follow.select().where(Follow.follower == self).count()
    
    def followers_count(self):
        """フォロワー数を取得"""
        from models.follow import Follow
        return Follow.select().where(Follow.followed == self).count()
    
    def is_following(self, user):
        """指定ユーザーをフォロー中かチェック"""
        from models.follow import Follow
        return Follow.select().where(
            (Follow.follower == self) & (Follow.followed == user)
        ).exists()
    
    def __repr__(self):
        return f'<User {self.username}>'
