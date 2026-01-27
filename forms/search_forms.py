"""
検索フォーム
"""
from flask_wtf import FlaskForm
from wtforms import StringField, SubmitField
from wtforms.validators import DataRequired, Length


class SearchForm(FlaskForm):
    """検索フォーム"""
    q = StringField(
        '検索',
        validators=[
            DataRequired(message='検索キーワードを入力してください'),
            Length(min=1, max=100, message='検索キーワードは1〜100文字で入力してください')
        ],
        render_kw={
            'placeholder': 'ユーザー名、キャプション、ハッシュタグで検索...',
            'class': 'form-control'
        }
    )
    
    submit = SubmitField('検索')
