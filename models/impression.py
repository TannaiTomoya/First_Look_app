"""
印象カード・肌診断モデル
"""
from peewee import (
    AutoField, ForeignKeyField, CharField, TextField, 
    DateTimeField, DeferredForeignKey
)
from datetime import datetime
from models import BaseModel


class DesiredFace(BaseModel):
    """なりたい印象カード（画像選択）"""
    id = AutoField(primary_key=True)
    label = CharField(max_length=50)  # 印象ラベル（例：知的、親しみやすい、清潔感）
    image_url = CharField(max_length=255)  # 画像URL
    description = TextField(null=True)  # 説明
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'desired_faces'
    
    def __repr__(self):
        return f'<DesiredFace {self.label}>'


class SkinCheck(BaseModel):
    """肌診断情報"""
    id = AutoField(primary_key=True)
    user = DeferredForeignKey('User', backref='skin_checks', on_delete='CASCADE')
    skin_type = CharField(max_length=20)  # 肌質：dry（乾燥）, oily（脂性）, combination（混合）, normal（普通）
    concerns = TextField()  # 悩み（カンマ区切り）：pores（毛穴）, dark_spots（黒ずみ）, tone（肌トーン）, acne（ニキビ）
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'skin_checks'
        indexes = (
            (('user',), False),
            (('created_at',), False),
        )
    
    def get_concerns_list(self):
        """悩みをリストで取得"""
        return self.concerns.split(',') if self.concerns else []
    
    def __repr__(self):
        return f'<SkinCheck {self.user.username} - {self.skin_type}>'
