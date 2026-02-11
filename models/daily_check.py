"""
当日チェック・Before/After投稿モデル
"""
from peewee import (
    AutoField, ForeignKeyField, IntegerField, TextField, 
    CharField, DateTimeField, DateField, DeferredForeignKey
)
from datetime import datetime, date
from models import BaseModel


class DailyCheck(BaseModel):
    """当日5分チェック"""
    id = AutoField(primary_key=True)
    user = DeferredForeignKey('User', backref='daily_checks', on_delete='CASCADE', column_name='user_id')
    check_date = DateField(default=date.today)  # チェック日
    eyebrow_ok = IntegerField(default=0)  # 眉：0=未確認, 1=OK, 2=要改善
    eye_ok = IntegerField(default=0)  # 目：0=未確認, 1=OK, 2=要改善
    nose_ok = IntegerField(default=0)  # 鼻：0=未確認, 1=OK, 2=要改善
    skin_ok = IntegerField(default=0)  # 肌：0=未確認, 1=OK, 2=要改善
    lip_ok = IntegerField(default=0)  # 口：0=未確認, 1=OK, 2=要改善
    notes = TextField(null=True)  # 備考
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'daily_checks'
        indexes = (
            (('user',), False),
            (('check_date',), False),
        )
    
    def is_complete(self):
        """全項目チェック済みかどうか"""
        return all([
            self.eyebrow_ok > 0,
            self.eye_ok > 0,
            self.nose_ok > 0,
            self.skin_ok > 0,
            self.lip_ok > 0
        ])
    
    def __repr__(self):
        return f'<DailyCheck {self.user.username} - {self.check_date}>'


class Photo(BaseModel):
    """写真保存（汎用）"""
    id = AutoField(primary_key=True)
    user = DeferredForeignKey('User', backref='photos', on_delete='CASCADE', column_name='user_id')
    purpose = CharField(max_length=50)  # 用途：coach_profile, before, after, daily_check
    file_path = CharField(max_length=255)  # ファイルパス
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'photos'
        indexes = (
            (('user',), False),
            (('purpose',), False),
        )
    
    def __repr__(self):
        return f'<Photo {self.id} - {self.purpose}>'


class BeforeAfterPost(BaseModel):
    """Before/After投稿"""
    id = AutoField(primary_key=True)
    user = DeferredForeignKey('User', backref='before_after_posts', on_delete='CASCADE', column_name='user_id')
    before_photo = DeferredForeignKey('Photo', backref='before_posts', on_delete='CASCADE', column_name='before_photo_id')
    after_photo = DeferredForeignKey('Photo', backref='after_posts', on_delete='CASCADE', column_name='after_photo_id')
    before_photo_2 = DeferredForeignKey('Photo', backref='before_posts_2', null=True, on_delete='CASCADE', column_name='before_photo_2_id')  # Before画像2（任意）
    after_photo_2 = DeferredForeignKey('Photo', backref='after_posts_2', null=True, on_delete='CASCADE', column_name='after_photo_2_id')  # After画像2（任意）
    caption = TextField(null=True)  # キャプション
    desired_face = DeferredForeignKey('DesiredFace', backref='posts', null=True, on_delete='SET NULL', column_name='desired_face_id')  # 紐付け印象カード
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'before_after_posts'
        indexes = (
            (('user',), False),
            (('created_at',), False),
        )
    
    def __repr__(self):
        return f'<BeforeAfterPost {self.id} by {self.user.username}>'
