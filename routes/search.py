"""
検索関連ルート
"""
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from forms.search_forms import SearchForm
from models.user import User
from models.post import Post

search = Blueprint('search', __name__, url_prefix='/search')


@search.route('/')
@login_required
def index():
    """
    検索ページ表示
    """
    form = SearchForm()
    return render_template('search/index.html', form=form)


@search.route('/results')
@login_required
def results():
    """
    検索結果表示
    """
    # クエリパラメータから検索キーワードを取得
    query = request.args.get('q', '').strip()
    
    if not query:
        flash('検索キーワードを入力してください', 'warning')
        return redirect(url_for('search.index'))
    
    # ハッシュタグ検索の場合、#を除去
    search_query = query.lstrip('#')
    
    # ユーザー名検索（部分一致）
    users = User.select().where(
        User.username.contains(search_query)
    ).limit(20)
    
    # 投稿検索（キャプション・ハッシュタグ）
    # キャプションに検索キーワードが含まれる投稿を取得
    posts = Post.select().where(
        (Post.caption.contains(search_query)) |
        (Post.caption.contains(f'#{search_query}'))  # ハッシュタグとしても検索
    ).order_by(Post.created_at.desc()).limit(50)
    
    return render_template(
        'search/results.html',
        query=query,
        users=users,
        posts=posts,
        user_count=users.count(),
        post_count=posts.count()
    )
