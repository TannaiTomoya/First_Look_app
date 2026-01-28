"""
ユーザー関連ルート - FirstLook
"""
from flask import Blueprint, render_template, redirect, url_for, flash, abort
from flask_login import login_required, current_user
from forms.profile_forms import ProfileEditForm
from models.user import User
from models.daily_check import BeforeAfterPost
from models.booking import Booking
from utils.image_handler import save_image

users = Blueprint('users', __name__, url_prefix='/users')


@users.route('/<username>')
@login_required
def profile(username):
    """
    プロフィールページ表示
    """
    # ユーザーを取得
    user = User.select().where(User.username == username).first()
    if not user:
        flash('ユーザーが見つかりません', 'danger')
        return redirect(url_for('index'))
    
    # Before/After投稿一覧を取得（新着順）
    before_after_posts = BeforeAfterPost.select().where(
        BeforeAfterPost.user == user
    ).order_by(BeforeAfterPost.created_at.desc())
    
    # 予約数（クライアントの場合）
    booking_count = 0
    if user.is_client():
        booking_count = Booking.select().where(Booking.client == user).count()
    
    return render_template(
        'users/profile.html',
        user=user,
        before_after_posts=before_after_posts,
        post_count=before_after_posts.count(),
        booking_count=booking_count
    )


@users.route('/<username>/edit', methods=['GET', 'POST'])
@login_required
def edit(username):
    """
    プロフィール編集
    """
    # 自分のプロフィールのみ編集可能
    if current_user.username != username:
        flash('他のユーザーのプロフィールは編集できません', 'danger')
        abort(403)
    
    form = ProfileEditForm()
    
    if form.validate_on_submit():
        try:
            # ユーザー名を更新
            current_user.username = form.username.data
            
            # 自己紹介を更新
            current_user.bio = form.bio.data
            
            # プロフィール画像をアップロード
            if form.profile_image.data:
                image_filename = save_image(form.profile_image.data, image_type='profile')
                current_user.profile_image = image_filename
            
            # データベースに保存
            current_user.save()
            
            flash('プロフィールを更新しました', 'success')
            return redirect(url_for('users.profile', username=current_user.username))
        
        except Exception as e:
            flash(f'プロフィールの更新に失敗しました: {str(e)}', 'danger')
    
    elif form.errors:
        # バリデーションエラー
        for field, errors in form.errors.items():
            for error in errors:
                flash(f'{error}', 'danger')
    
    # フォームに現在の値を設定
    if not form.is_submitted():
        form.username.data = current_user.username
        form.bio.data = current_user.bio
    
    return render_template('users/edit.html', form=form)
