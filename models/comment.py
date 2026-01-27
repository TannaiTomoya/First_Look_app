"""
コメントモデル
"""
from peewee import AutoField, TextField, DeferredForeignKey, DateTimeField
from datetime import datetime
from models import BaseModel


class Comment(BaseModel):
    """投稿へのコメント情報を管理"""
    id = AutoField(primary_key=True)
    content = TextField()
    user = DeferredForeignKey('User', backref='comments', on_delete='CASCADE')
    post = DeferredForeignKey('Post', backref='comments', on_delete='CASCADE')
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'comments'
        indexes = (
            (('post',), False),
            (('created_at',), False),
        )
    
    def __repr__(self):
        return f'<Comment {self.id} on Post {self.post.id}>'
