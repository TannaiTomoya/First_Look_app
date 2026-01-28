"""
チャット関連モデル
"""
from peewee import (
    AutoField, ForeignKeyField, TextField, DateTimeField, 
    DeferredForeignKey, CharField, IntegerField
)
from datetime import datetime
from models import BaseModel


class Chat(BaseModel):
    """1対1チャットルーム"""
    id = AutoField(primary_key=True)
    booking = DeferredForeignKey('Booking', backref='chat', unique=True, on_delete='CASCADE')
    created_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'chats'
        indexes = (
            (('booking',), True),
        )
    
    def get_participants(self):
        """チャット参加者を取得（client, coach）"""
        # DeferredForeignKey対応: 明示的にBookingを取得
        from models.booking import Booking
        from models.user import User
        
        booking = Booking.get_by_id(self.booking)
        client_user = User.get_by_id(booking.client)
        coach = booking.get_coach()
        coach_user = User.get_by_id(coach.user)
        
        return {
            'client': client_user,
            'coach': coach_user
        }
    
    def __repr__(self):
        return f'<Chat {self.id} for Booking {self.booking}>'


class Message(BaseModel):
    """チャットメッセージ"""
    id = AutoField(primary_key=True)
    chat = DeferredForeignKey('Chat', backref='messages', on_delete='CASCADE')
    sender = DeferredForeignKey('User', backref='sent_messages', on_delete='CASCADE')
    content = TextField()  # メッセージ内容
    image_path = CharField(max_length=255, null=True)  # 添付画像パス
    is_deleted = IntegerField(default=0)  # 削除フラグ（0: 通常, 1: 削除済み）
    sent_at = DateTimeField(default=datetime.now)
    deleted_at = DateTimeField(null=True)  # 削除日時
    
    class Meta:
        table_name = 'messages'
        indexes = (
            (('chat',), False),
            (('sender',), False),
            (('sent_at',), False),
        )
    
    def __repr__(self):
        from models.user import User
        sender_user = User.get_by_id(self.sender) if isinstance(self.sender, int) else self.sender
        return f'<Message {self.id} from {sender_user.username}>'
