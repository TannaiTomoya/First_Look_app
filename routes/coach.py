"""
コーチ管理ルート
"""
from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from functools import wraps
from models.coach import Coach, Menu
from models.impression import DesiredFace
from models.daily_check import BeforeAfterPost
from utils.uploads import save_image, get_upload_subdir, InvalidImageFormatError, InvalidImageDataError

coach = Blueprint('coach', __name__, url_prefix='/coach')


def coach_required(f):
    """コーチ専用デコレーター"""
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if not current_user.is_coach():
            flash('この機能はコーチのみ利用できます', 'warning')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function


@coach.route('/dashboard')
@coach_required
def dashboard():
    """コーチダッシュボード"""
    coach_profile = Coach.select().where(Coach.user == current_user).first()
    
    # メニュー一覧
    menus = Menu.select().where(
        (Menu.coach == coach_profile) & (Menu.is_active == 1)
    ).order_by(Menu.created_at.desc())
    
    # 予約件数と最近の予約
    from models.booking import Booking
    from models.user import User
    
    booking_count = Booking.select().join(
        Menu,
        on=(Booking.menu == Menu.id)
    ).where(
        Menu.coach == coach_profile
    ).count()
    
    # 最近の予約（直近10件）
    recent_bookings_raw = Booking.select().join(
        Menu,
        on=(Booking.menu == Menu.id)
    ).where(
        Menu.coach == coach_profile
    ).order_by(Booking.created_at.desc()).limit(10)
    
    # DeferredForeignKey対応: 各予約の関連データを明示的に取得
    recent_bookings = []
    for booking in recent_bookings_raw:
        menu_obj = Menu.get_by_id(booking.menu)
        client_user = User.get_by_id(booking.client)
        
        booking.menu_obj = menu_obj
        booking.client_user = client_user
        
        recent_bookings.append(booking)
    
    return render_template(
        'coach/dashboard.html',
        coach_profile=coach_profile,
        menus=menus,
        booking_count=booking_count,
        recent_bookings=recent_bookings
    )


@coach.route('/profile/edit', methods=['GET', 'POST'])
@coach_required
def edit_profile():
    """プロフィール編集"""
    coach_profile = Coach.select().where(Coach.user == current_user).first()
    
    if request.method == 'POST':
        try:
            # プロフィール写真の処理
            profile_image = request.files.get('profile_image')
            if profile_image and profile_image.filename:
                try:
                    # 新しいアップロードユーティリティを使用
                    subdir = get_upload_subdir('profile')
                    image_path = save_image(profile_image, subdir, max_size=200, quality=85)
                    current_user.profile_image = image_path
                except (InvalidImageFormatError, InvalidImageDataError) as e:
                    flash(f'画像アップロードエラー: {str(e)}', 'danger')
                    return render_template('coach/edit_profile.html', coach_profile=coach_profile)
            
            # プロフィール更新
            coach_profile.bio = request.form.get('bio', '')
            coach_profile.expertise = request.form.get('expertise', '')
            coach_profile.area = request.form.get('area', '')
            coach_profile.price_range = request.form.get('price_range', '')
            coach_profile.save()
            
            # ユーザー情報も更新
            current_user.bio = request.form.get('user_bio', '')
            current_user.save()
            
            flash('プロフィールを更新しました', 'success')
            return redirect(url_for('coach.dashboard'))
        except Exception as e:
            flash(f'更新中にエラーが発生しました: {str(e)}', 'danger')
    
    return render_template('coach/edit_profile.html', coach_profile=coach_profile)


@coach.route('/menu/create', methods=['GET', 'POST'])
@coach_required
def create_menu():
    """メニュー作成"""
    coach_profile = Coach.select().where(Coach.user == current_user).first()
    
    if request.method == 'POST':
        try:
            Menu.create(
                coach=coach_profile,
                title=request.form.get('title'),
                description=request.form.get('description', ''),
                price=int(request.form.get('price', 0)),
                duration=int(request.form.get('duration', 0))
            )
            flash('メニューを作成しました', 'success')
            return redirect(url_for('coach.dashboard'))
        except Exception as e:
            flash(f'作成中にエラーが発生しました: {str(e)}', 'danger')
    
    return render_template('coach/create_menu.html')


@coach.route('/menu/<int:menu_id>/edit', methods=['GET', 'POST'])
@coach_required
def edit_menu(menu_id):
    """メニュー編集"""
    coach_profile = Coach.select().where(Coach.user == current_user).first()
    menu = Menu.select().where(
        (Menu.id == menu_id) & (Menu.coach == coach_profile)
    ).first()
    
    if not menu:
        flash('メニューが見つかりません', 'danger')
        return redirect(url_for('coach.dashboard'))
    
    if request.method == 'POST':
        try:
            menu.title = request.form.get('title')
            menu.description = request.form.get('description', '')
            menu.price = int(request.form.get('price', 0))
            menu.duration = int(request.form.get('duration', 0))
            menu.save()
            
            flash('メニューを更新しました', 'success')
            return redirect(url_for('coach.dashboard'))
        except Exception as e:
            flash(f'更新中にエラーが発生しました: {str(e)}', 'danger')
    
    return render_template('coach/edit_menu.html', menu=menu)


@coach.route('/menu/<int:menu_id>/delete', methods=['POST'])
@coach_required
def delete_menu(menu_id):
    """メニュー削除"""
    coach_profile = Coach.select().where(Coach.user == current_user).first()
    menu = Menu.select().where(
        (Menu.id == menu_id) & (Menu.coach == coach_profile)
    ).first()
    
    if not menu:
        flash('メニューが見つかりません', 'danger')
        return redirect(url_for('coach.dashboard'))
    
    try:
        # 論理削除（is_activeを0に）
        menu.is_active = 0
        menu.save()
        flash('メニューを削除しました', 'success')
    except Exception as e:
        flash(f'削除中にエラーが発生しました: {str(e)}', 'danger')
    
    return redirect(url_for('coach.dashboard'))


@coach.route('/list')
def list_coaches():
    """コーチ一覧（Hot Pepper風）"""
    # クエリパラメータでフィルタリング
    area = request.args.get('area', '')
    
    query = Coach.select()
    
    # エリアでフィルタリング
    if area:
        query = query.where(Coach.area.contains(area))
    
    coaches_raw = query.order_by(Coach.created_at.desc())
    
    # DeferredForeignKey対応: 各コーチのuserを明示的に取得
    from models.user import User
    coaches = []
    for coach in coaches_raw:
        coach_user = User.get_by_id(coach.user)
        coach.user_obj = coach_user
        coaches.append(coach)
    
    return render_template('coach/list.html', coaches=coaches, area=area)


@coach.route('/<int:coach_id>')
def detail(coach_id):
    """コーチ詳細"""
    coach_profile = Coach.select().where(Coach.id == coach_id).first()
    
    if not coach_profile:
        flash('コーチが見つかりません', 'danger')
        return redirect(url_for('coach.list_coaches'))
    
    # DeferredForeignKey対応: userを明示的に取得
    from models.user import User
    coach_user = User.get_by_id(coach_profile.user)
    coach_profile.user_obj = coach_user
    
    # メニュー一覧
    menus = Menu.select().where(
        (Menu.coach == coach_profile) & (Menu.is_active == 1)
    ).order_by(Menu.price.asc())
    
    # Before/After事例（このコーチのクライアントの投稿）
    # TODO: 後で実装
    before_after_posts = []
    
    return render_template(
        'coach/detail.html',
        coach_profile=coach_profile,
        menus=menus,
        before_after_posts=before_after_posts
    )
