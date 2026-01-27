"""
いいねモデル
"""
from peewee import AutoField, DeferredForeignKey, DateTimeField
from datetime import datetime
from models import BaseModel


class Like(BaseModel):
    """投稿へのいいね情報を管理"""
    id = AutoField(primary_key=True)
    user = DeferredForeignKey('User', backref='likes', on_delete='CASCADE')
    post = DeferredForeignKey('Post', backref='likes', on_delete='CASCADE')
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'likes'
        indexes = (
            (('user', 'post'), True),  # unique index
            (('post',), False),
        )
    
    def __repr__(self):
        return f'<Like user={self.user.id} post={self.post.id}>'
