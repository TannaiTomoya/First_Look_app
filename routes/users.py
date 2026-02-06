"""
ユーザー関連ルート - FirstLook
"""
from flask import Blueprint, render_template, redirect, url_for, flash, abort
from flask_login import login_required, current_user
from forms.profile_forms import ProfileEditForm
from models.user import User
from utils.uploads import save_image, get_upload_subdir, InvalidImageFormatError, InvalidImageDataError

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
    
    return render_template(
        'users/profile.html',
        user=user
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
                try:
                    # 新しいアップロードユーティリティを使用
                    subdir = get_upload_subdir('profile')
                    image_path = save_image(form.profile_image.data, subdir, max_size=200, quality=85)
                    current_user.profile_image = image_path
                except InvalidImageFormatError as e:
                    flash(f'画像形式エラー: {str(e)}', 'danger')
                    return render_template('users/edit.html', form=form)
                except InvalidImageDataError as e:
                    flash(f'画像データエラー: {str(e)}', 'danger')
                    return render_template('users/edit.html', form=form)
            
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
