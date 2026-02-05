"""
データベースモデルパッケージ - FirstLook
"""
from peewee import Model

# データベースインスタンスをインポート（単一ソース）
from db import db

class BaseModel(Model):
    """全モデルの基底クラス"""
    class Meta:
        database = db

# モデルのインポート（DeferredForeignKeyを使用しているため順序は自由）
from models.user import User
from models.coach import Coach, Menu
from models.impression import DesiredFace, SkinCheck
from models.booking import Booking
from models.chat import Chat, Message
from models.daily_check import DailyCheck, Photo, BeforeAfterPost
from models.face_template import FaceTemplate, FacePart, FaceComposition

__all__ = [
    'db',
    'BaseModel',
    'User',
    'Coach',
    'Menu',
    'DesiredFace',
    'SkinCheck',
    'Booking',
    'Chat',
    'Message',
    'DailyCheck',
    'Photo',
    'BeforeAfterPost',
    'FaceTemplate',
    'FacePart',
    'FaceComposition',
]
