"""
ユーザー関連ルート
"""
from flask import Blueprint, render_template, redirect, url_for, flash, abort
from flask_login import login_required, current_user
from forms.profile_forms import ProfileEditForm
from models.user import User
from models.post import Post
from models.follow import Follow
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
    
    # 投稿一覧を取得（新着順）
    posts = Post.select().where(Post.user == user).order_by(Post.created_at.desc())
    
    # 統計情報
    post_count = user.post_count()
    following_count = user.following_count()
    followers_count = user.followers_count()
    
    # フォロー状態（自分以外の場合）
    is_following = False
    if current_user.id != user.id:
        is_following = current_user.is_following(user)
    
    return render_template(
        'users/profile.html',
        user=user,
        posts=posts,
        post_count=post_count,
        following_count=following_count,
        followers_count=followers_count,
        is_following=is_following
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


@users.route('/<username>/follow', methods=['POST'])
@login_required
def follow(username):
    """
    ユーザーをフォロー
    """
    # フォロー対象ユーザーを取得
    user = User.select().where(User.username == username).first()
    if not user:
        flash('ユーザーが見つかりません', 'danger')
        return redirect(url_for('index'))
    
    # 自分自身はフォローできない
    if current_user.id == user.id:
        flash('自分自身をフォローすることはできません', 'warning')
        return redirect(url_for('users.profile', username=username))
    
    # 既にフォロー済みかチェック
    existing_follow = Follow.select().where(
        (Follow.follower == current_user) & (Follow.followed == user)
    ).first()
    
    if existing_follow:
        flash('既にフォローしています', 'info')
    else:
        # フォローを作成
        Follow.create(follower=current_user, followed=user)
        flash(f'{user.username} をフォローしました', 'success')
    
    return redirect(url_for('users.profile', username=username))


@users.route('/<username>/unfollow', methods=['POST'])
@login_required
def unfollow(username):
    """
    ユーザーのフォローを解除
    """
    # フォロー対象ユーザーを取得
    user = User.select().where(User.username == username).first()
    if not user:
        flash('ユーザーが見つかりません', 'danger')
        return redirect(url_for('index'))
    
    # フォロー関係を取得
    follow = Follow.select().where(
        (Follow.follower == current_user) & (Follow.followed == user)
    ).first()
    
    if follow:
        # フォローを削除
        follow.delete_instance()
        flash(f'{user.username} のフォローを解除しました', 'info')
    else:
        flash('フォローしていません', 'warning')
    
    return redirect(url_for('users.profile', username=username))


@users.route('/<username>/following')
@login_required
def following(username):
    """
    フォロー中リスト表示
    """
    # ユーザーを取得
    user = User.select().where(User.username == username).first()
    if not user:
        flash('ユーザーが見つかりません', 'danger')
        return redirect(url_for('index'))
    
    # フォロー中のユーザーリストを取得
    following_list = Follow.select().where(Follow.follower == user).order_by(Follow.created_at.desc())
    
    return render_template(
        'users/following.html',
        user=user,
        following_list=following_list
    )


@users.route('/<username>/followers')
@login_required
def followers(username):
    """
    フォロワーリスト表示
    """
    # ユーザーを取得
    user = User.select().where(User.username == username).first()
    if not user:
        flash('ユーザーが見つかりません', 'danger')
        return redirect(url_for('index'))
    
    # フォロワーリストを取得
    followers_list = Follow.select().where(Follow.followed == user).order_by(Follow.created_at.desc())
    
    return render_template(
        'users/followers.html',
        user=user,
        followers_list=followers_list
    )
