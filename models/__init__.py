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

# NOTE: Step4-B 時点では Export は JSON/PNG で成立しており、DBモデルは不要。
# 未実装モデルを import すると起動不能になるため、一旦外す。
# from models.face_adjustment import FaceAdjustment
# from models.render_export import RenderExport

__all__ = [
    "db",
    "BaseModel",
    "User",
    "Coach",
    "Menu",
    "DesiredFace",
    "SkinCheck",
    "Booking",
    "Chat",
    "Message",
    "DailyCheck",
    "Photo",
    "BeforeAfterPost",
    "FaceTemplate",
    "FacePart",
    "FaceComposition",
    # "FaceAdjustment",  # Step4-B: 未実装のため一旦外す
    # "RenderExport",    # Step4-B: 未実装のため一旦外す
]
