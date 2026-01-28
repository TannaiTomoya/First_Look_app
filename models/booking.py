"""
予約関連モデル
"""
from peewee import (
    AutoField, ForeignKeyField, CharField, DateTimeField, 
    IntegerField, DeferredForeignKey
)
from datetime import datetime
from models import BaseModel


class Booking(BaseModel):
    """予約情報"""
    id = AutoField(primary_key=True)
    client = DeferredForeignKey('User', backref='bookings_as_client', on_delete='CASCADE')
    menu = DeferredForeignKey('Menu', backref='bookings', on_delete='CASCADE')
    booking_datetime = DateTimeField()  # 予約日時
    status = CharField(max_length=20, default='pending')  # pending, confirmed, completed, cancelled
    notes = CharField(max_length=500, null=True)  # 備考
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    
    class Meta:
        table_name = 'bookings'
        indexes = (
            (('client',), False),
            (('menu',), False),
            (('booking_datetime',), False),
            (('status',), False),
        )
    
    def save(self, *args, **kwargs):
        """保存時にupdated_atを更新"""
        self.updated_at = datetime.now()
        return super(Booking, self).save(*args, **kwargs)
    
    def get_coach(self):
        """予約のコーチを取得（DeferredForeignKey対応）"""
        from models.coach import Menu, Coach
        
        # DeferredForeignKey対応: 明示的にMenuとCoachを取得
        menu = Menu.get_by_id(self.menu)
        coach = Coach.get_by_id(menu.coach)
        return coach
    
    def __repr__(self):
        from models.user import User
        client_user = User.get_by_id(self.client) if isinstance(self.client, int) else self.client
        return f'<Booking {self.id} - {client_user.username}>'
