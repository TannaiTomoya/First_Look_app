"""
フォローモデル
"""
from peewee import AutoField, DeferredForeignKey, DateTimeField
from datetime import datetime
from models import BaseModel


class Follow(BaseModel):
    """ユーザー間のフォロー関係を管理"""
    id = AutoField(primary_key=True)
    follower = DeferredForeignKey('User', backref='following', on_delete='CASCADE')
    followed = DeferredForeignKey('User', backref='followers', on_delete='CASCADE')
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'follows'
        indexes = (
            (('follower', 'followed'), True),  # unique index
            (('follower',), False),
            (('followed',), False),
        )
    
    def __repr__(self):
        return f'<Follow {self.follower.username} -> {self.followed.username}>'
