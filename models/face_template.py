"""
顔テンプレート・パーツモデル
"""
from peewee import (
    AutoField, CharField, IntegerField, FloatField, 
    DateTimeField, DeferredForeignKey, TextField
)
from datetime import datetime
from models import BaseModel


class FaceTemplate(BaseModel):
    """顔のベース画像"""
    id = AutoField(primary_key=True)
    user = DeferredForeignKey('User', backref='face_templates', on_delete='CASCADE')
    impression = DeferredForeignKey('DesiredFace', backref='templates', null=True, on_delete='SET NULL')
    base_image_path = CharField(max_length=255)  # ベース画像パス
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'face_templates'
        indexes = (
            (('user',), False),
        )
    
    def __repr__(self):
        return f'<FaceTemplate {self.id} by User {self.user}>'


class FacePart(BaseModel):
    """顔パーツ（眉、鼻など）"""
    id = AutoField(primary_key=True)
    part_type = CharField(max_length=50)  # 'eyebrow', 'nose'
    label = CharField(max_length=100)  # '自然な眉', 'シャープな鼻'
    image_url = CharField(max_length=255)  # パーツ画像URL
    position_x = IntegerField(default=0)  # 配置X座標（%）
    position_y = IntegerField(default=0)  # 配置Y座標（%）
    scale = FloatField(default=1.0)  # 拡大率
    is_ai_generated = IntegerField(default=0)  # AI生成フラグ
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'face_parts'
        indexes = (
            (('part_type',), False),
        )
    
    def __repr__(self):
        return f'<FacePart {self.label} ({self.part_type})>'


class FaceComposition(BaseModel):
    """ユーザーの顔パーツ選択・合成"""
    id = AutoField(primary_key=True)
    user = DeferredForeignKey('User', backref='face_compositions', on_delete='CASCADE')
    template = DeferredForeignKey('FaceTemplate', backref='compositions', on_delete='CASCADE')
    eyebrow_part = DeferredForeignKey('FacePart', backref='eyebrow_uses', null=True, on_delete='SET NULL')
    nose_part = DeferredForeignKey('FacePart', backref='nose_uses', null=True, on_delete='SET NULL')
    adjustments = TextField(null=True)  # JSON形式で微調整データを保存
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'face_compositions'
        indexes = (
            (('user',), False),
        )
    
    def __repr__(self):
        return f'<FaceComposition {self.id} by User {self.user}>'
