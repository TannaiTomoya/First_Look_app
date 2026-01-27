"""
投稿フォーム
"""
from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileRequired, FileAllowed
from wtforms import TextAreaField, SubmitField
from wtforms.validators import DataRequired, Optional, Length


class PostForm(FlaskForm):
    """投稿作成フォーム"""
    image = FileField(
        '画像',
        validators=[
            FileRequired(message='画像ファイルを選択してください'),
            FileAllowed(
                ['jpg', 'jpeg', 'png', 'gif'],
                message='JPEG、PNG、GIF形式の画像ファイルのみアップロード可能です'
            )
        ],
        description='JPEG、PNG、GIF形式の画像ファイルをアップロード'
    )

    caption = TextAreaField(
        'キャプション',
        validators=[
            Optional(),
            Length(max=2000, message='キャプションは2000文字以内で入力してください')
        ],
        render_kw={
            'placeholder': 'キャプションを入力（任意）',
            'rows': 4
        }
    )

    submit = SubmitField('投稿する')


class CommentForm(FlaskForm):
    """コメント投稿フォーム"""
    content = TextAreaField(
        'コメント',
        validators=[
            DataRequired(message='コメントを入力してください'),
            Length(min=1, max=500, message='コメントは1〜500文字で入力してください')
        ],
        render_kw={
            'placeholder': 'コメントを入力...',
            'rows': 2
        }
    )

    submit = SubmitField('コメント')
