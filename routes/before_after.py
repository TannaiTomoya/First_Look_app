"""
Before/After投稿関連ルート
"""
from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from models.daily_check import BeforeAfterPost, Photo
from models.impression import DesiredFace
from utils.uploads import save_image, get_upload_subdir, delete_image, InvalidImageFormatError, InvalidImageDataError
import os

before_after = Blueprint('before_after', __name__, url_prefix='/before-after')


@before_after.route('/list')
def list_posts():
    """Before/After投稿一覧"""
    posts_raw = BeforeAfterPost.select().order_by(
        BeforeAfterPost.created_at.desc()
    ).limit(50)
    
    # DeferredForeignKey対応: 各投稿の関連データを明示的に取得
    from models.user import User
    
    posts = []
    for post in posts_raw:
        before_photo = Photo.get_by_id(post.before_photo)
        after_photo = Photo.get_by_id(post.after_photo)
        user = User.get_by_id(post.user)
        
        post.before_photo = before_photo
        post.after_photo = after_photo
        post.user = user
        
        # 2枚目の写真も取得（nullの可能性あり）
        if post.before_photo_2:
            before_photo_2 = Photo.get_by_id(post.before_photo_2)
            post.before_photo_2 = before_photo_2
        
        if post.after_photo_2:
            after_photo_2 = Photo.get_by_id(post.after_photo_2)
            post.after_photo_2 = after_photo_2
        
        # desired_faceも解決（nullの可能性あり）
        if post.desired_face:
            desired_face = DesiredFace.get_by_id(post.desired_face)
            post.desired_face = desired_face
        
        posts.append(post)
    
    return render_template('before_after/list.html', posts=posts)


@before_after.route('/create', methods=['GET', 'POST'])
@login_required
def create():
    """Before/After投稿作成"""
    if request.method == 'POST':
        try:
            # Before画像1（必須）
            before_file = request.files.get('before_image')
            if not before_file or before_file.filename == '':
                flash('Before画像1を選択してください', 'danger')
                return redirect(url_for('before_after.create'))
            
            # After画像1（必須）
            after_file = request.files.get('after_image')
            if not after_file or after_file.filename == '':
                flash('After画像1を選択してください', 'danger')
                return redirect(url_for('before_after.create'))
            
            # Before画像2（任意）
            before_file_2 = request.files.get('before_image_2')
            
            # After画像2（任意）
            after_file_2 = request.files.get('after_image_2')
            
            # アップロード用サブディレクトリ
            subdir = get_upload_subdir('before_after')
            
            # 画像を保存（1枚目）
            try:
                before_path = save_image(before_file, subdir, max_size=1080, quality=85)
                after_path = save_image(after_file, subdir, max_size=1080, quality=85)
            except (InvalidImageFormatError, InvalidImageDataError) as e:
                flash(f'画像アップロードエラー: {str(e)}', 'danger')
                faces = DesiredFace.select().order_by(DesiredFace.id.asc())
                return render_template('before_after/create.html', faces=faces)
            
            # Photoレコード作成（1枚目）
            before_photo = Photo.create(
                user=current_user,
                purpose='before',
                file_path=before_path
            )
            
            after_photo = Photo.create(
                user=current_user,
                purpose='after',
                file_path=after_path
            )
            
            # Photoレコード作成（2枚目・任意）
            before_photo_2 = None
            if before_file_2 and before_file_2.filename:
                try:
                    before_path_2 = save_image(before_file_2, subdir, max_size=1080, quality=85)
                    before_photo_2 = Photo.create(
                        user=current_user,
                        purpose='before',
                        file_path=before_path_2
                    )
                except (InvalidImageFormatError, InvalidImageDataError) as e:
                    flash(f'Before画像2のアップロードエラー: {str(e)}。他の画像は保存されました。', 'warning')
            
            after_photo_2 = None
            if after_file_2 and after_file_2.filename:
                try:
                    after_path_2 = save_image(after_file_2, subdir, max_size=1080, quality=85)
                    after_photo_2 = Photo.create(
                        user=current_user,
                        purpose='after',
                        file_path=after_path_2
                    )
                except (InvalidImageFormatError, InvalidImageDataError) as e:
                    flash(f'After画像2のアップロードエラー: {str(e)}。他の画像は保存されました。', 'warning')
            
            # 印象カードID
            desired_face_id = request.form.get('desired_face_id')
            desired_face = None
            if desired_face_id:
                desired_face = DesiredFace.select().where(
                    DesiredFace.id == int(desired_face_id)
                ).first()
            
            # Before/After投稿作成
            post = BeforeAfterPost.create(
                user=current_user,
                before_photo=before_photo,
                after_photo=after_photo,
                before_photo_2=before_photo_2,
                after_photo_2=after_photo_2,
                caption=request.form.get('caption', ''),
                desired_face=desired_face
            )
            
            flash('投稿を作成しました', 'success')
            return redirect(url_for('before_after.detail', post_id=post.id))
            
        except Exception as e:
            flash(f'投稿作成中にエラーが発生しました: {str(e)}', 'danger')
    
    # 印象カード一覧
    faces = DesiredFace.select().order_by(DesiredFace.id.asc())
    
    return render_template('before_after/create.html', faces=faces)


@before_after.route('/<int:post_id>')
def detail(post_id):
    """Before/After投稿詳細"""
    post = BeforeAfterPost.select().where(
        BeforeAfterPost.id == post_id
    ).first()
    
    if not post:
        flash('投稿が見つかりません', 'danger')
        return redirect(url_for('before_after.list_posts'))
    
    # DeferredForeignKey対応: 関連データを明示的に取得
    from models.user import User
    
    before_photo = Photo.get_by_id(post.before_photo)
    after_photo = Photo.get_by_id(post.after_photo)
    user = User.get_by_id(post.user)
    
    # postに関連データを追加
    post.before_photo = before_photo
    post.after_photo = after_photo
    post.user = user
    
    # 2枚目の写真も取得（nullの可能性あり）
    if post.before_photo_2:
        before_photo_2 = Photo.get_by_id(post.before_photo_2)
        post.before_photo_2 = before_photo_2
    
    if post.after_photo_2:
        after_photo_2 = Photo.get_by_id(post.after_photo_2)
        post.after_photo_2 = after_photo_2
    
    # desired_faceも解決（nullの可能性あり）
    if post.desired_face:
        desired_face = DesiredFace.get_by_id(post.desired_face)
        post.desired_face = desired_face
    
    return render_template('before_after/detail.html', post=post)


@before_after.route('/<int:post_id>/delete', methods=['POST'])
@login_required
def delete(post_id):
    """Before/After投稿削除"""
    post = BeforeAfterPost.select().where(
        BeforeAfterPost.id == post_id
    ).first()
    
    if not post:
        flash('投稿が見つかりません', 'danger')
        return redirect(url_for('before_after.list_posts'))
    
    # DeferredForeignKey対応: Photoオブジェクトを明示的に取得
    before_photo = Photo.get_by_id(post.before_photo)
    after_photo = Photo.get_by_id(post.after_photo)
    
    # 権限チェック（userもIDの可能性あり）
    user_id = post.user if isinstance(post.user, int) else post.user.id
    if user_id != current_user.id:
        flash('この投稿を削除する権限がありません', 'danger')
        return redirect(url_for('before_after.detail', post_id=post_id))
    
    try:
        # 物理ファイルのパスを先に取得（レコード削除前に）
        file_paths = []
        
        # 1枚目の画像パス
        file_paths.append(before_photo.file_path)
        file_paths.append(after_photo.file_path)
        
        # 2枚目の画像パス（存在する場合）
        if post.before_photo_2:
            before_photo_2_obj = Photo.get_by_id(post.before_photo_2)
            file_paths.append(before_photo_2_obj.file_path)
        
        if post.after_photo_2:
            after_photo_2_obj = Photo.get_by_id(post.after_photo_2)
            file_paths.append(after_photo_2_obj.file_path)
        
        # レコード削除（on_delete='CASCADE'によりPhotoレコードも自動削除される）
        post.delete_instance()
        
        # 物理ファイルを削除（レコード削除後）
        for file_path in file_paths:
            delete_image(file_path)
        
        flash('投稿を削除しました', 'success')
        return redirect(url_for('before_after.list_posts'))
        
    except Exception as e:
        flash(f'削除中にエラーが発生しました: {str(e)}', 'danger')
        return redirect(url_for('before_after.detail', post_id=post_id))
