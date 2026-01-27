"""
投稿モデル
"""
from peewee import AutoField, CharField, TextField, ForeignKeyField, DateTimeField, DeferredForeignKey
from datetime import datetime
from models import BaseModel


class Post(BaseModel):
    """写真投稿情報を管理"""
    id = AutoField(primary_key=True)
    image_file = CharField(max_length=255)
    caption = TextField(null=True)
    user = DeferredForeignKey('User', backref='posts', on_delete='CASCADE')
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'posts'
        indexes = (
            (('user',), False),
            (('created_at',), False),
        )
    
    def like_count(self):
        """いいね数を取得"""
        return self.likes.count()
    
    def is_liked_by(self, user):
        """指定ユーザーがいいね済みかチェック"""
        from models.like import Like
        return Like.select().where(
            (Like.post == self) & (Like.user == user)
        ).exists()
    
    def __repr__(self):
        return f'<Post {self.id} by {self.user.username}>'


# よく使うクエリのヘルパー関数
def get_timeline_posts(current_user):
    """フォロー中のユーザーの投稿を取得"""
    from models.follow import Follow
    following_users = Follow.select(Follow.followed).where(Follow.follower == current_user)
    posts = Post.select().where(
        (Post.user.in_(following_users)) | (Post.user == current_user)
    ).order_by(Post.created_at.desc())
    return posts


def get_explore_posts():
    """全ユーザーの投稿を取得（探索タブ用）"""
    return Post.select().order_by(Post.created_at.desc())
