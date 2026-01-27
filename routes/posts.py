"""
投稿関連ルート
"""
from flask import Blueprint, render_template, redirect, url_for, flash, request, abort
from flask_login import login_required, current_user
from forms.post_forms import PostForm, CommentForm
from models.post import Post, get_explore_posts, get_timeline_posts
from models.comment import Comment
from utils.image_handler import save_image, delete_image

posts = Blueprint('posts', __name__, url_prefix='/posts')


@posts.route('/explore')
@login_required
def explore():
    """
    探索タブ - 全投稿を新着順に表示
    """
    # ページネーション設定
    page = request.args.get('page', 1, type=int)
    per_page = 12  # 1ページあたりの投稿数

    # 全投稿を取得（新着順）
    all_posts = get_explore_posts()
    total_posts = all_posts.count()

    # ページネーション処理
    posts_paginated = all_posts.paginate(page, per_page)

    # ページ情報
    has_prev = page > 1
    has_next = page * per_page < total_posts
    prev_page = page - 1 if has_prev else None
    next_page = page + 1 if has_next else None

    return render_template(
        'posts/explore.html',
        posts=posts_paginated,
        page=page,
        has_prev=has_prev,
        has_next=has_next,
        prev_page=prev_page,
        next_page=next_page
    )


@posts.route('/create', methods=['GET', 'POST'])
@login_required
def create():
    """
    投稿作成
    """
    form = PostForm()

    if form.validate_on_submit():
        try:
            # 画像を保存
            image_filename = save_image(form.image.data, image_type='post')

            # 投稿を作成
            post = Post.create(
                user=current_user.id,
                image_file=image_filename,
                caption=form.caption.data
            )

            flash('投稿を作成しました', 'success')
            return redirect(url_for('posts.detail', post_id=post.id))

        except ValueError as e:
            flash(f'投稿の作成に失敗しました: {str(e)}', 'danger')
        except Exception as e:
            flash(f'予期しないエラーが発生しました: {str(e)}', 'danger')

    return render_template('posts/create.html', form=form)


@posts.route('/<int:post_id>')
@login_required
def detail(post_id):
    """
    投稿詳細表示
    """
    try:
        # 投稿を取得
        post = Post.get_by_id(post_id)
    except Post.DoesNotExist:
        flash('投稿が見つかりません', 'danger')
        return redirect(url_for('posts.explore'))

    # コメントフォーム
    comment_form = CommentForm()

    # コメント一覧を取得（新着順）
    comments = Comment.select().where(
        Comment.post == post
    ).order_by(Comment.created_at.asc())

    # いいね数と自分がいいね済みかチェック
    like_count = post.like_count()
    is_liked = post.is_liked_by(current_user)

    return render_template(
        'posts/detail.html',
        post=post,
        comment_form=comment_form,
        comments=comments,
        like_count=like_count,
        is_liked=is_liked
    )


@posts.route('/<int:post_id>/delete', methods=['POST'])
@login_required
def delete(post_id):
    """
    投稿削除（投稿者のみ）
    """
    try:
        # 投稿を取得
        post = Post.get_by_id(post_id)
    except Post.DoesNotExist:
        flash('投稿が見つかりません', 'danger')
        return redirect(url_for('posts.explore'))

    # 投稿者本人かチェック
    if post.user.id != current_user.id:
        flash('この投稿を削除する権限がありません', 'danger')
        abort(403)

    try:
        # 画像ファイルを削除
        delete_image(post.image_file, image_type='post')

        # 投稿を削除（カスケードでいいね・コメントも削除される）
        post.delete_instance()

        flash('投稿を削除しました', 'info')
        return redirect(url_for('posts.explore'))

    except Exception as e:
        flash(f'投稿の削除に失敗しました: {str(e)}', 'danger')
        return redirect(url_for('posts.detail', post_id=post_id))


@posts.route('/<int:post_id>/comment', methods=['POST'])
@login_required
def add_comment(post_id):
    """
    コメント投稿
    """
    try:
        # 投稿を取得
        post = Post.get_by_id(post_id)
    except Post.DoesNotExist:
        flash('投稿が見つかりません', 'danger')
        return redirect(url_for('posts.explore'))

    form = CommentForm()

    if form.validate_on_submit():
        try:
            # コメントを作成
            Comment.create(
                user=current_user.id,
                post=post,
                content=form.content.data
            )

            flash('コメントを投稿しました', 'success')
        except Exception as e:
            flash(f'コメントの投稿に失敗しました: {str(e)}', 'danger')
    else:
        # バリデーションエラー
        for field, errors in form.errors.items():
            for error in errors:
                flash(f'{error}', 'danger')

    return redirect(url_for('posts.detail', post_id=post_id))


@posts.route('/<int:post_id>/comment/<int:comment_id>/delete', methods=['POST'])
@login_required
def delete_comment(post_id, comment_id):
    """
    コメント削除（コメント投稿者のみ）
    """
    try:
        # コメントを取得
        comment = Comment.get_by_id(comment_id)
    except Comment.DoesNotExist:
        flash('コメントが見つかりません', 'danger')
        return redirect(url_for('posts.detail', post_id=post_id))

    # コメント投稿者本人かチェック
    if comment.user.id != current_user.id:
        flash('このコメントを削除する権限がありません', 'danger')
        abort(403)

    try:
        # コメントを削除
        comment.delete_instance()
        flash('コメントを削除しました', 'info')
    except Exception as e:
        flash(f'コメントの削除に失敗しました: {str(e)}', 'danger')

    return redirect(url_for('posts.detail', post_id=post_id))
