"""
コーチプロフィールモデル
"""
from peewee import (
    AutoField, ForeignKeyField, TextField, CharField, 
    IntegerField, DateTimeField, DeferredForeignKey
)
from datetime import datetime
from models import BaseModel


class Coach(BaseModel):
    """コーチプロフィール情報を管理（User拡張）"""
    id = AutoField(primary_key=True)
    user = DeferredForeignKey('User', backref='coach_profile', unique=True, on_delete='CASCADE')
    bio = TextField(null=True)  # 自己紹介
    expertise = TextField(null=True)  # 得意分野
    area = CharField(max_length=100, null=True)  # 対応エリア
    price_range = CharField(max_length=50, null=True)  # 価格帯（例：¥5,000-¥10,000）
    profile_photo_id = IntegerField(null=True)  # プロフィール写真ID（Photoテーブル参照）
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'coaches'
        indexes = (
            (('user',), True),
        )
    
    def save(self, *args, **kwargs):
        """保存時にupdated_atを更新"""
        self.updated_at = datetime.now()
        return super(Coach, self).save(*args, **kwargs)
    
    def __repr__(self):
        from models.user import User
        user = User.get_by_id(self.user) if isinstance(self.user, int) else self.user
        return f'<Coach {user.username}>'


class Menu(BaseModel):
    """コーチのメニュー管理"""
    id = AutoField(primary_key=True)
    coach = DeferredForeignKey('Coach', backref='menus', on_delete='CASCADE')
    title = CharField(max_length=100)  # メニュータイトル
    description = TextField(null=True)  # メニュー内容
    price = IntegerField()  # 価格（円）
    duration = IntegerField()  # 所要時間（分）
    is_active = IntegerField(default=1)  # 有効/無効
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'menus'
        indexes = (
            (('coach',), False),
            (('is_active',), False),
        )
    
    def save(self, *args, **kwargs):
        """保存時にupdated_atを更新"""
        self.updated_at = datetime.now()
        return super(Menu, self).save(*args, **kwargs)
    
    def __repr__(self):
        return f'<Menu {self.title}>'
