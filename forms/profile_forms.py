"""
プロフィールフォーム
"""
from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileAllowed
from wtforms import StringField, TextAreaField, SubmitField
from wtforms.validators import DataRequired, Length, ValidationError, Optional
from flask_login import current_user
from models.user import User


class ProfileEditForm(FlaskForm):
    """プロフィール編集フォーム"""
    username = StringField(
        'ユーザー名',
        validators=[
            DataRequired(message='ユーザー名は必須です'),
            Length(min=3, max=50, message='ユーザー名は3〜50文字で入力してください')
        ]
    )
    
    bio = TextAreaField(
        '自己紹介',
        validators=[
            Optional(),
            Length(max=500, message='自己紹介は500文字以内で入力してください')
        ],
        render_kw={
            'placeholder': '自己紹介を入力（任意）',
            'rows': 4
        }
    )
    
    profile_image = FileField(
        'プロフィール画像',
        validators=[
            FileAllowed(
                ['jpg', 'jpeg', 'png', 'gif'],
                message='JPEG、PNG、GIF形式の画像ファイルのみアップロード可能です'
            )
        ],
        description='JPEG、PNG、GIF形式の画像ファイルをアップロード'
    )
    
    submit = SubmitField('保存')
    
    def validate_username(self, username):
        """ユーザー名の重複チェック（自分以外）"""
        if username.data != current_user.username:
            user = User.select().where(User.username == username.data).first()
            if user:
                raise ValidationError('このユーザー名は既に使用されています')
