"""
ユーザーモデル
"""
from peewee import AutoField, CharField, TextField, DateTimeField, IntegerField, DateField, DeferredForeignKey, ForeignKeyField
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
    gender = CharField(max_length=10, default='male')  # 'male' or 'female'
    desired_face = DeferredForeignKey('DesiredFace', null=True, backref='users', on_delete='SET NULL')  # 選択中の印象カード
    streak_freeze = IntegerField(default=2)  # Freeze残数（最大2）
    last_freeze_used_at = DateField(null=True)  # 最後にFreezeを使用した日
    referral_code = CharField(max_length=16, unique=True, null=True)  # 招待コード
    referred_by_id = IntegerField(null=True)  # 紹介者のユーザーID
    hide_scores = IntegerField(default=0)  # スコア非表示設定（0=表示、1=非表示）
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
    
    def is_female(self):
        """女性ユーザーかどうか"""
        return self.gender == 'female'
    
    def is_male(self):
        """男性ユーザーかどうか"""
        return self.gender == 'male'
    
    def get_referrer(self):
        """紹介者を取得"""
        if self.referred_by_id:
            return User.get_by_id(self.referred_by_id)
        return None
    
    def get_referred_users(self):
        """このユーザーが紹介したユーザー一覧"""
        return User.select().where(User.referred_by_id == self.id)
    
    def save(self, *args, **kwargs):
        """保存時にupdated_atを更新"""
        self.updated_at = datetime.now()
        return super(User, self).save(*args, **kwargs)

    def __repr__(self):
        return f'<User {self.username}>'
