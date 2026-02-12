"""
達成バッジモデル
"""

from peewee import AutoField, CharField, DateTimeField, ForeignKeyField
from datetime import datetime
from models import BaseModel
from models.user import User


class Achievement(BaseModel):
    """達成バッジ情報を管理"""

    id = AutoField(primary_key=True)
    user = ForeignKeyField(User, backref='achievements', on_delete='CASCADE')
    key = CharField(max_length=50)  # streak_7, streak_30, streak_100
    earned_at = DateTimeField(default=datetime.now)

    class Meta:
        table_name = 'achievements'
        indexes = (
            (('user', 'key'), True),  # UNIQUE制約
        )

    def __repr__(self):
        return f'<Achievement {self.key} - User {self.user_id}>'
