"""
Daily Action（今日の一歩）モデル
毎日1つのタスクを提示し、習慣化を促進
"""
from peewee import (
    AutoField, CharField, DateField, BooleanField,
    DateTimeField, DeferredForeignKey
)
from datetime import datetime, date
from models import BaseModel


class DailyAction(BaseModel):
    """今日の一歩（1日1タスク）"""
    id = AutoField(primary_key=True)
    user_id = DeferredForeignKey('User', backref='daily_actions', on_delete='CASCADE')
    date = DateField(default=date.today)  # タスク日（YYYY-MM-DD）
    action_key = CharField(max_length=50)  # アクションキー（face_wash, moisturizeなど）
    completed = BooleanField(default=False)  # 完了フラグ
    created_at = DateTimeField(default=datetime.now)

    class Meta:
        table_name = 'daily_actions'
        indexes = (
            (('user_id', 'date'), True),  # UNIQUE(user_id, date) - 同日1件のみ
            (('user_id',), False),
            (('date',), False),
            (('completed',), False),
        )

    def __repr__(self):
        return f'<DailyAction {self.user_id.username} - {self.date} - {self.action_key}>'
