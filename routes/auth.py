"""
認証関連ルート（Flask-Login 1.0.0対応）
"""
from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required
from forms.auth_forms import RegisterForm, LoginForm
from models.user import User
from urllib.parse import urlparse, urljoin

auth = Blueprint('auth', __name__)


def is_safe_url(target):
    """
    リダイレクト先URLが安全かチェック（オープンリダイレクト対策）
    
    Args:
        target: チェック対象のURL
    
    Returns:
        bool: 安全な場合True
    """
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme in ('http', 'https') and ref_url.netloc == test_url.netloc


@auth.route('/register', methods=['GET', 'POST'])
def register():
    """ユーザー登録"""
    form = RegisterForm()

    if form.validate_on_submit():
        try:
            from utils.referral import generate_referral_code, process_referral
            from utils.event_logger import log_event, EVENT_SIGNUP

            # 新規ユーザーの作成（クライアントのみ）
            user = User(
                username=form.username.data,
                email=form.email.data,
                role='client',  # 男性版MVPではクライアントのみ
                gender=form.gender.data
            )
            # パスワードのハッシュ化
            user.set_password(form.password.data)
            
            # 招待コード生成
            user.referral_code = generate_referral_code()
            
            user.save()

            # イベントログ記録
            log_event(user, EVENT_SIGNUP)

            # 招待コードが入力されている場合
            referral_code = request.form.get('referral_code', '').strip()
            if referral_code:
                success = process_referral(user, referral_code)
                if success:
                    flash('登録が完了しました。紹介ボーナスでFreeze +1を獲得！', 'success')
                else:
                    flash('登録が完了しました。（招待コードが無効でした）', 'warning')
            else:
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
            # Flask-Login 1.0.0: remember引数でセッションの永続化を制御
            login_user(user, remember=form.remember_me.data, duration=None)
            flash(f'ようこそ、{user.username}さん！', 'success')

            # next パラメータがあればそこにリダイレクト（セキュリティチェック付き）
            next_page = request.args.get('next')
            if next_page and is_safe_url(next_page):
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
