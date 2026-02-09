"""
認証フォーム
"""
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField, SelectField
from wtforms.validators import (
    DataRequired,
    Email,
    Length,
    EqualTo,
    ValidationError
)
from models.user import User


class RegisterForm(FlaskForm):
    """ユーザー登録フォーム"""
    username = StringField(
        'ユーザー名',
        validators=[
            DataRequired(message='ユーザー名は必須です'),
            Length(min=3, max=50, message='ユーザー名は3〜50文字で入力してください')
        ]
    )

    email = StringField(
        'メールアドレス',
        validators=[
            DataRequired(message='メールアドレスは必須です'),
            Email(message='有効なメールアドレスを入力してください'),
            Length(max=120, message='メールアドレスは120文字以内で入力してください')
        ]
    )

    password = PasswordField(
        'パスワード',
        validators=[
            DataRequired(message='パスワードは必須です'),
            Length(min=8, message='パスワードは8文字以上で入力してください')
        ]
    )

    confirm_password = PasswordField(
        'パスワード（確認）',
        validators=[
            DataRequired(message='確認用パスワードは必須です'),
            EqualTo('password', message='パスワードが一致しません')
        ]
    )

    gender = SelectField(
        '性別',
        choices=[('male', '男性'), ('female', '女性')],
        validators=[DataRequired(message='性別を選択してください')]
    )

    age_confirm = BooleanField(
        '18歳以上確認',
        validators=[DataRequired(message='18歳以上であることを確認してください')]
    )

    terms_agree = BooleanField(
        '利用規約同意',
        validators=[DataRequired(message='利用規約とプライバシーポリシーに同意してください')]
    )

    submit = SubmitField('登録')

    def validate_username(self, username):
        """ユーザー名の重複チェック"""
        user = User.select().where(User.username == username.data).first()
        if user:
            raise ValidationError('このユーザー名は既に使用されています')

    def validate_email(self, email):
        """メールアドレスの重複チェック"""
        user = User.select().where(User.email == email.data).first()
        if user:
            raise ValidationError('このメールアドレスは既に登録されています')


class LoginForm(FlaskForm):
    """ログインフォーム"""
    username = StringField(
        'ユーザー名',
        validators=[
            DataRequired(message='ユーザー名は必須です')
        ]
    )

    password = PasswordField(
        'パスワード',
        validators=[
            DataRequired(message='パスワードは必須です')
        ]
    )

    remember_me = BooleanField('ログイン状態を保持')

    submit = SubmitField('ログイン')
