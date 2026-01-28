"""
クライアント関連ルート
"""
from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from functools import wraps
from models.impression import DesiredFace, SkinCheck
from models.booking import Booking
from models.coach import Menu, Coach
from models.user import User
from models.chat import Chat, Message
from models.daily_check import DailyCheck
from datetime import datetime, date

client = Blueprint('client', __name__, url_prefix='/client')


def client_required(f):
    """クライアント専用デコレーター"""
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if not current_user.is_client():
            flash('この機能はクライアントのみ利用できます', 'warning')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function


@client.route('/dashboard')
@client_required
def dashboard():
    """クライアントダッシュボード"""
    # 肌質・悩みの変換辞書（英語 → 日本語 + 画像パス）
    skin_type_map = {
        'dry': {'label': '乾燥肌', 'image': 'images/skin_types/dry_skin.jpg'},
        'oily': {'label': '脂性肌', 'image': 'images/skin_types/oily_skin.jpg'},
        'combination': {'label': '混合肌', 'image': 'images/skin_types/combination_skin.jpg'},
        'normal': {'label': '普通肌', 'image': 'images/skin_types/normal_skin.jpg'}
    }
    
    concerns_map = {
        'pores': {'label': '毛穴の開き', 'image': 'images/skin_concerns/pores.jpg'},
        'dark_spots': {'label': '黒ずみ', 'image': 'images/skin_concerns/dark_spots.jpg'},
        'tone': {'label': '肌トーンの不均一', 'image': 'images/skin_concerns/tone.jpg'},
        'acne': {'label': 'ニキビケア', 'image': 'images/skin_concerns/acne.jpg'}
    }
    
    # 選択中の印象カードを取得
    selected_impression = None
    if current_user.desired_face:
        # DeferredForeignKey対応: 明示的にDesiredFaceを取得
        if isinstance(current_user.desired_face, int):
            selected_impression = DesiredFace.get_by_id(current_user.desired_face)
        else:
            selected_impression = current_user.desired_face
    
    # 最新の肌診断
    latest_skin_check = SkinCheck.select().where(
        SkinCheck.user == current_user
    ).order_by(SkinCheck.created_at.desc()).first()
    
    # 肌診断データを整形（画像と日本語表示用）
    skin_check_data = None
    if latest_skin_check:
        # 悩みをカンマ区切りで分割して、各悩みの情報を取得
        concerns_list = []
        if latest_skin_check.concerns:
            for concern_key in latest_skin_check.concerns.split(','):
                concern_key = concern_key.strip()
                if concern_key and concern_key in concerns_map:
                    concerns_list.append(concerns_map[concern_key])
        
        skin_check_data = {
            'skin_type': skin_type_map.get(latest_skin_check.skin_type, {}),
            'concerns': concerns_list,
            'created_at': latest_skin_check.created_at
        }
    
    # 予約一覧（関連データを明示的に取得）
    bookings_raw = Booking.select().where(
        Booking.client == current_user
    ).order_by(Booking.booking_datetime.desc()).limit(5)
    
    # DeferredForeignKeyの遅延ロード問題を回避するため、
    # 予約データを整形して必要な情報を事前に取得
    bookings = []
    for booking in bookings_raw:
        # menuを取得
        menu = Menu.get_by_id(booking.menu)
        # coachを取得
        coach = Coach.get_by_id(menu.coach)
        # userを取得
        coach_user = User.get_by_id(coach.user)
        
        # bookingに必要な情報を追加
        booking.menu_obj = menu
        booking.coach_obj = coach
        booking.coach_user = coach_user
        bookings.append(booking)
    
    # 今日のチェック
    today_check = DailyCheck.select().where(
        (DailyCheck.user == current_user) &
        (DailyCheck.check_date == date.today())
    ).first()
    
    return render_template(
        'client/dashboard.html',
        selected_impression=selected_impression,
        latest_skin_check=latest_skin_check,
        skin_check_data=skin_check_data,
        bookings=bookings,
        today_check=today_check
    )


@client.route('/impression/select', methods=['GET', 'POST'])
@client_required
def select_impression():
    """印象カード選択"""
    faces = DesiredFace.select().order_by(DesiredFace.id.asc())
    
    if request.method == 'POST':
        try:
            face_id = request.form.get('desired_face_id')
            if face_id:
                face = DesiredFace.select().where(DesiredFace.id == int(face_id)).first()
                if face:
                    current_user.desired_face = face
                    current_user.save()
                    flash('印象カードを選択しました', 'success')
                else:
                    flash('選択された印象カードが見つかりません', 'danger')
            else:
                flash('印象カードを選択してください', 'warning')
            return redirect(url_for('client.dashboard'))
        except Exception as e:
            flash(f'選択中にエラーが発生しました: {str(e)}', 'danger')
    
    return render_template('client/select_impression.html', faces=faces)


@client.route('/skin-check', methods=['GET', 'POST'])
@client_required
def skin_check():
    """肌診断フォーム"""
    if request.method == 'POST':
        try:
            skin_type = request.form.get('skin_type')
            concerns = ','.join(request.form.getlist('concerns'))
            
            SkinCheck.create(
                user=current_user,
                skin_type=skin_type,
                concerns=concerns
            )
            
            flash('肌診断を保存しました', 'success')
            return redirect(url_for('client.dashboard'))
        except Exception as e:
            flash(f'保存中にエラーが発生しました: {str(e)}', 'danger')
    
    # 最新の肌診断を取得
    latest_check = SkinCheck.select().where(
        SkinCheck.user == current_user
    ).order_by(SkinCheck.created_at.desc()).first()
    
    return render_template('client/skin_check.html', latest_check=latest_check)


@client.route('/daily-check', methods=['GET', 'POST'])
@client_required
def daily_check():
    """当日5分チェック"""
    # 今日のチェックを取得
    today = date.today()
    today_check = DailyCheck.select().where(
        (DailyCheck.user == current_user) &
        (DailyCheck.check_date == today)
    ).first()
    
    # 保存完了フラグ
    check_saved = False
    
    if request.method == 'POST':
        try:
            if today_check:
                # 更新
                today_check.eyebrow_ok = int(request.form.get('eyebrow_ok', 0))
                today_check.eye_ok = int(request.form.get('eye_ok', 0))
                today_check.nose_ok = int(request.form.get('nose_ok', 0))
                today_check.skin_ok = int(request.form.get('skin_ok', 0))
                today_check.lip_ok = int(request.form.get('lip_ok', 0))
                today_check.notes = request.form.get('notes', '')
                today_check.save()
            else:
                # 新規作成
                today_check = DailyCheck.create(
                    user=current_user,
                    check_date=today,
                    eyebrow_ok=int(request.form.get('eyebrow_ok', 0)),
                    eye_ok=int(request.form.get('eye_ok', 0)),
                    nose_ok=int(request.form.get('nose_ok', 0)),
                    skin_ok=int(request.form.get('skin_ok', 0)),
                    lip_ok=int(request.form.get('lip_ok', 0)),
                    notes=request.form.get('notes', '')
                )
            
            check_saved = True
            flash('チェックを保存しました', 'success')
            
        except Exception as e:
            flash(f'保存中にエラーが発生しました: {str(e)}', 'danger')
    
    return render_template('client/daily_check.html', 
                         today_check=today_check,
                         check_saved=check_saved)
