"""
Look Records（見た目記録）モデル
Future Face機能による自己改善記録
"""
from peewee import (
    AutoField, CharField, DateField,
    IntegerField, DateTimeField, DeferredForeignKey
)
from datetime import datetime, date
from models import BaseModel


class LookRecord(BaseModel):
    """見た目記録（1日1件）"""
    id = AutoField(primary_key=True)
    user = DeferredForeignKey('User', backref='look_records', on_delete='CASCADE')
    date = DateField(default=date.today)  # 記録日（YYYY-MM-DD）
    photo_path = CharField(max_length=255)  # 保存した画像パス
    preset = CharField(max_length=20)  # all/slim/skin/young
    strength = IntegerField(default=40)  # 0-100
    created_at = DateTimeField(default=datetime.now)

    # AIコーチ判定スコア（Phase B）
    score_total = IntegerField(null=True)  # 清潔感スコア（総合）0-100
    score_contour = IntegerField(null=True)  # 輪郭シャープ度 0-100
    score_skin = IntegerField(null=True)  # 肌の整い度 0-100
    score_young = IntegerField(null=True)  # 若見え度 0-100
    score_diff = IntegerField(null=True)  # 前回比（前回との差分）

    class Meta:
        table_name = 'look_records'
        indexes = (
            (('user', 'date'), True),  # UNIQUE(user_id, date) - 同日1件のみ
            (('user',), False),
            (('date',), False),
        )

    def __repr__(self):
        return f'<LookRecord {self.user.username} - {self.date}>'
