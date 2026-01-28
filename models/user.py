"""
ユーザーモデル
"""
from peewee import AutoField, CharField, TextField, DateTimeField, IntegerField, DeferredForeignKey
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
    role = CharField(max_length=20, default='client')  # 'client' or 'coach'
    desired_face = DeferredForeignKey('DesiredFace', null=True, backref='users', on_delete='SET NULL')  # 選択中の印象カード
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)

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

    def before_after_post_count(self):
        """Before/After投稿数を取得"""
        return self.before_after_posts.count()
    
    def is_client(self):
        """クライアントかどうか"""
        return self.role == 'client'
    
    def is_coach(self):
        """コーチかどうか"""
        return self.role == 'coach'
    
    def save(self, *args, **kwargs):
        """保存時にupdated_atを更新"""
        self.updated_at = datetime.now()
        return super(User, self).save(*args, **kwargs)

    def __repr__(self):
        return f'<User {self.username}>'
