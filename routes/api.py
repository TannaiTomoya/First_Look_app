"""
API関連ルート（Ajax用）
"""
from flask import Blueprint, jsonify, abort
from flask_login import login_required, current_user
from models.post import Post
from models.like import Like

api = Blueprint('api', __name__, url_prefix='/api')


@api.route('/posts/<int:post_id>/like', methods=['POST'])
@login_required
def toggle_like(post_id):
    """
    いいねの追加・削除（トグル）
    
    Returns:
        JSON: {
            'success': bool,
            'liked': bool,
            'like_count': int
        }
    """
    try:
        # 投稿を取得
        post = Post.get_by_id(post_id)
    except Post.DoesNotExist:
        abort(404)
    
    # 既にいいね済みかチェック
    existing_like = Like.select().where(
        (Like.user == current_user) & (Like.post == post)
    ).first()
    
    if existing_like:
        # いいね済み → 削除
        existing_like.delete_instance()
        liked = False
    else:
        # いいねしていない → 追加
        Like.create(user=current_user, post=post)
        liked = True
    
    # 最新のいいね数を取得
    like_count = post.like_count()
    
    return jsonify({
        'success': True,
        'liked': liked,
        'like_count': like_count
    })
