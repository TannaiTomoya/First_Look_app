"""
イベントログモデル
"""

from peewee import AutoField, CharField, DateTimeField, ForeignKeyField
from datetime import datetime
from models import BaseModel
from models.user import User


class EventLog(BaseModel):
    """ユーザーイベントログを管理"""

    id = AutoField(primary_key=True)
    user = ForeignKeyField(User, null=True, backref='event_logs', on_delete='SET NULL')
    event = CharField(max_length=100)  # signup, saved_record, completed_daily_action, etc.
    created_at = DateTimeField(default=datetime.now)

    class Meta:
        table_name = 'event_logs'
        indexes = (
            (('user', 'event'), False),
            (('created_at',), False),
        )

    def __repr__(self):
        return f'<EventLog {self.event} - User {self.user_id}>'
