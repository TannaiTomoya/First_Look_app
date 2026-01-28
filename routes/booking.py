"""
予約関連ルート
"""
from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from models.booking import Booking
from models.coach import Menu, Coach
from models.user import User
from models.chat import Chat, Message
from datetime import datetime

booking = Blueprint('booking', __name__, url_prefix='/booking')


@booking.route('/create/<int:menu_id>', methods=['GET', 'POST'])
@login_required
def create(menu_id):
    """予約作成"""
    menu = Menu.select().where(Menu.id == menu_id).first()
    
    if not menu:
        flash('メニューが見つかりません', 'danger')
        return redirect(url_for('coach.list_coaches'))
    
    # コーチ情報を明示的に取得（DeferredForeignKey対応）
    coach_profile = Coach.get_by_id(menu.coach)
    coach_user = User.get_by_id(coach_profile.user)
    
    if request.method == 'POST':
        try:
            # 日時をパース
            booking_date = request.form.get('booking_date')
            booking_time = request.form.get('booking_time')
            booking_datetime = datetime.strptime(
                f"{booking_date} {booking_time}",
                "%Y-%m-%d %H:%M"
            )
            
            # 予約作成
            new_booking = Booking.create(
                client=current_user,
                menu=menu,
                booking_datetime=booking_datetime,
                notes=request.form.get('notes', ''),
                status='pending'
            )
            
            # 予約完了時に1対1チャット自動生成
            chat = Chat.create(booking=new_booking)
            
            # システムメッセージを追加
            Message.create(
                chat=chat,
                sender=current_user,
                content=f'予約が完了しました。{coach_user.username}コーチとのチャットを開始します。'
            )
            
            flash('予約が完了しました！チャットでコーチとやり取りができます。', 'success')
            return redirect(url_for('booking.detail', booking_id=new_booking.id))
            
        except Exception as e:
            flash(f'予約中にエラーが発生しました: {str(e)}', 'danger')
    
    return render_template(
        'booking/create.html',
        menu=menu,
        coach_profile=coach_profile,
        coach_user=coach_user
    )


@booking.route('/<int:booking_id>')
@login_required
def detail(booking_id):
    """予約詳細"""
    booking_obj = Booking.select().where(Booking.id == booking_id).first()
    
    if not booking_obj:
        flash('予約が見つかりません', 'danger')
        return redirect(url_for('client.dashboard'))
    
    # 関連データを明示的に取得（DeferredForeignKey対応）
    client_user = User.get_by_id(booking_obj.client)
    menu_obj = Menu.get_by_id(booking_obj.menu)
    coach_profile = Coach.get_by_id(menu_obj.coach)
    coach_user = User.get_by_id(coach_profile.user)
    
    # アクセス権限チェック
    if current_user.id != client_user.id and current_user.id != coach_user.id:
        flash('この予約にアクセスする権限がありません', 'danger')
        return redirect(url_for('index'))
    
    # チャットを取得
    chat = Chat.select().where(Chat.booking == booking_obj).first()
    
    # bookingオブジェクトに関連データを追加
    booking_obj.client_user = client_user
    booking_obj.menu_obj = menu_obj
    booking_obj.coach_profile = coach_profile
    booking_obj.coach_user = coach_user
    
    return render_template(
        'booking/detail.html',
        booking=booking_obj,
        chat=chat
    )


@booking.route('/<int:booking_id>/confirm', methods=['POST'])
@login_required
def confirm(booking_id):
    """予約確定（コーチのみ）"""
    booking_obj = Booking.select().where(Booking.id == booking_id).first()
    
    if not booking_obj:
        flash('予約が見つかりません', 'danger')
        return redirect(url_for('coach.dashboard'))
    
    # コーチのみ実行可能（DeferredForeignKey対応）
    menu_obj = Menu.get_by_id(booking_obj.menu)
    coach_profile = Coach.get_by_id(menu_obj.coach)
    coach_user = User.get_by_id(coach_profile.user)
    
    if current_user.id != coach_user.id:
        flash('この操作を行う権限がありません', 'danger')
        return redirect(url_for('index'))
    
    try:
        booking_obj.status = 'confirmed'
        booking_obj.save()
        flash('予約を確定しました', 'success')
    except Exception as e:
        flash(f'確定中にエラーが発生しました: {str(e)}', 'danger')
    
    return redirect(url_for('booking.detail', booking_id=booking_id))


@booking.route('/<int:booking_id>/complete', methods=['POST'])
@login_required
def complete(booking_id):
    """予約完了（コーチのみ）"""
    booking_obj = Booking.select().where(Booking.id == booking_id).first()
    
    if not booking_obj:
        flash('予約が見つかりません', 'danger')
        return redirect(url_for('coach.dashboard'))
    
    # コーチのみ実行可能（DeferredForeignKey対応）
    menu_obj = Menu.get_by_id(booking_obj.menu)
    coach_profile = Coach.get_by_id(menu_obj.coach)
    coach_user = User.get_by_id(coach_profile.user)
    
    if current_user.id != coach_user.id:
        flash('この操作を行う権限がありません', 'danger')
        return redirect(url_for('index'))
    
    try:
        booking_obj.status = 'completed'
        booking_obj.save()
        flash('セッションを完了しました', 'success')
    except Exception as e:
        flash(f'完了中にエラーが発生しました: {str(e)}', 'danger')
    
    return redirect(url_for('booking.detail', booking_id=booking_id))


@booking.route('/<int:booking_id>/cancel', methods=['POST'])
@login_required
def cancel(booking_id):
    """予約キャンセル"""
    booking_obj = Booking.select().where(Booking.id == booking_id).first()
    
    if not booking_obj:
        flash('予約が見つかりません', 'danger')
        return redirect(url_for('client.dashboard'))
    
    # クライアントまたはコーチが実行可能（DeferredForeignKey対応）
    client_user = User.get_by_id(booking_obj.client)
    menu_obj = Menu.get_by_id(booking_obj.menu)
    coach_profile = Coach.get_by_id(menu_obj.coach)
    coach_user = User.get_by_id(coach_profile.user)
    
    if current_user.id != client_user.id and current_user.id != coach_user.id:
        flash('この操作を行う権限がありません', 'danger')
        return redirect(url_for('index'))
    
    try:
        booking_obj.status = 'cancelled'
        booking_obj.save()
        flash('予約をキャンセルしました', 'info')
    except Exception as e:
        flash(f'キャンセル中にエラーが発生しました: {str(e)}', 'danger')
    
    return redirect(url_for('booking.detail', booking_id=booking_id))
