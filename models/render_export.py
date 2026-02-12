"""
確定レンダリング成果物モデル（Step4）
"""
from peewee import (
    AutoField, TextField, BooleanField, DateTimeField, DeferredForeignKey
)
from datetime import datetime
from models import BaseModel
import secrets


class RenderExport(BaseModel):
    """高品質レンダリング成果物"""
    id = AutoField(primary_key=True)
    user = DeferredForeignKey('User', backref='render_exports', on_delete='CASCADE')
    template = DeferredForeignKey('FaceTemplate', backref='exports', on_delete='CASCADE')
    state_json = TextField()  # レンダリング時点のstateを凍結
    output_path = TextField()  # 確定画像パス（uploads/exports/...）
    share_token = TextField(unique=True, index=True)  # 推測困難なランダム文字列
    is_public = BooleanField(default=True)  # 共有可能フラグ
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'render_exports'
        indexes = (
            (('user',), False),
            (('share_token',), True),
        )
    
    @staticmethod
    def generate_share_token(length=32):
        """共有用トークンを生成（推測困難な32文字）"""
        return secrets.token_urlsafe(length)
    
    def __repr__(self):
        return f'<RenderExport {self.id} by User {self.user}>'
