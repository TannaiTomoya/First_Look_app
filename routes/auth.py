"""
認証関連ルート
"""
from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required
from forms.auth_forms import RegisterForm, LoginForm
from models.user import User

auth = Blueprint('auth', __name__)


@auth.route('/register', methods=['GET', 'POST'])
def register():
    """ユーザー登録"""
    form = RegisterForm()

    if form.validate_on_submit():
        try:
            # 新規ユーザーの作成
            user = User(
                username=form.username.data,
                email=form.email.data
            )
            # パスワードのハッシュ化
            user.set_password(form.password.data)
            user.save()

            flash('登録が完了しました。ログインしてください。', 'success')
            return redirect(url_for('auth.login'))

        except Exception as e:
            flash(f'登録中にエラーが発生しました: {str(e)}', 'danger')

    return render_template('auth/register.html', form=form)


@auth.route('/login', methods=['GET', 'POST'])
def login():
    """ログイン"""
    form = LoginForm()

    if form.validate_on_submit():
        # ユーザーの検索
        user = User.select().where(User.username == form.username.data).first()

        # ユーザーが存在し、パスワードが正しい場合
        if user and user.check_password(form.password.data):
            login_user(user, remember=form.remember_me.data)
            flash(f'ようこそ、{user.username}さん！', 'success')

            # next パラメータがあればそこにリダイレクト
            next_page = request.args.get('next')
            if next_page:
                return redirect(next_page)
            return redirect(url_for('index'))
        else:
            flash('ユーザー名またはパスワードが正しくありません', 'danger')

    return render_template('auth/login.html', form=form)


@auth.route('/logout', methods=['POST'])
@login_required
def logout():
    """ログアウト"""
    logout_user()
    flash('ログアウトしました', 'info')
    return redirect(url_for('auth.login'))
