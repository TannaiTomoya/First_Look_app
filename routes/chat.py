"""
チャット関連ルート
"""
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from models.chat import Chat, Message
from models.booking import Booking
from models.coach import Menu, Coach
from models.user import User
from datetime import datetime

chat_bp = Blueprint('chat', __name__, url_prefix='/chat')


@chat_bp.route('/list')
@login_required
def list_chats():
    """チャット一覧"""
    if current_user.is_client():
        # クライアント: 自分の予約に紐づくチャット
        chats_raw = Chat.select().join(
            Booking,
            on=(Chat.booking == Booking.id)
        ).where(
            Booking.client == current_user
        ).order_by(Chat.created_at.desc())
    else:
        # コーチ: 自分のメニューの予約に紐づくチャット
        coach_profile = Coach.select().where(Coach.user == current_user).first()
        if not coach_profile:
            flash('コーチプロフィールが見つかりません', 'warning')
            return redirect(url_for('index'))
        
        chats_raw = Chat.select().join(
            Booking,
            on=(Chat.booking == Booking.id)
        ).join(
            Menu,
            on=(Booking.menu == Menu.id)
        ).where(
            Menu.coach == coach_profile
        ).order_by(Chat.created_at.desc())
    
    # DeferredForeignKey対応: 各チャットの関連データを事前取得
    chats = []
    for chat in chats_raw:
        booking = Booking.get_by_id(chat.booking)
        menu_obj = Menu.get_by_id(booking.menu)
        
        # bookingに関連データを追加
        booking.menu_obj = menu_obj
        chat.booking_obj = booking
        chats.append(chat)
    
    return render_template('chat/list.html', chats=chats)


@chat_bp.route('/<int:chat_id>')
@login_required
def detail(chat_id):
    """チャット詳細"""
    chat = Chat.select().where(Chat.id == chat_id).first()
    
    if not chat:
        flash('チャットが見つかりません', 'danger')
        return redirect(url_for('chat.list_chats'))
    
    # アクセス権限チェック
    participants = chat.get_participants()
    if current_user.id not in [participants['client'].id, participants['coach'].id]:
        flash('このチャットにアクセスする権限がありません', 'danger')
        return redirect(url_for('chat.list_chats'))
    
    # 予約と関連データを明示的に取得（DeferredForeignKey対応）
    booking = Booking.get_by_id(chat.booking)
    client_user = User.get_by_id(booking.client)
    menu_obj = Menu.get_by_id(booking.menu)
    coach_profile = Coach.get_by_id(menu_obj.coach)
    coach_user = User.get_by_id(coach_profile.user)
    
    # bookingに関連データを追加
    booking.client_user = client_user
    booking.menu_obj = menu_obj
    booking.coach_user = coach_user
    
    # メッセージ一覧（DeferredForeignKey対応）
    messages_raw = Message.select().where(
        Message.chat == chat
    ).order_by(Message.sent_at.asc())
    
    # 各メッセージの送信者情報を明示的に取得
    messages = []
    for msg in messages_raw:
        sender_user = User.get_by_id(msg.sender) if isinstance(msg.sender, int) else msg.sender
        msg.sender = sender_user
        messages.append(msg)
    
    return render_template(
        'chat/detail.html',
        chat=chat,
        messages=messages,
        booking=booking
    )


@chat_bp.route('/<int:chat_id>/send', methods=['GET', 'POST'])
@login_required
def send_message(chat_id):
    """メッセージ送信（画像添付対応）"""
    # GETリクエストの場合はチャット詳細にリダイレクト
    if request.method == 'GET':
        return redirect(url_for('chat.detail', chat_id=chat_id))
    
    chat = Chat.select().where(Chat.id == chat_id).first()
    
    if not chat:
        flash('チャットが見つかりません', 'danger')
        return redirect(url_for('chat.list_chats'))
    
    # アクセス権限チェック
    participants = chat.get_participants()
    if current_user.id not in [participants['client'].id, participants['coach'].id]:
        flash('アクセス権限がありません', 'danger')
        return redirect(url_for('chat.list_chats'))
    
    content = request.form.get('content', '').strip()
    image_file = request.files.get('image')
    image_path = None
    
    # 画像アップロード処理
    if image_file and image_file.filename:
        try:
            from utils.image_handler import save_chat_image
            image_path = save_chat_image(image_file)
        except Exception as e:
            flash(f'画像のアップロードに失敗しました: {str(e)}', 'danger')
            return redirect(url_for('chat.detail', chat_id=chat_id))
    
    # メッセージまたは画像のいずれかが必要
    if not content and not image_path:
        flash('メッセージまたは画像を入力してください', 'warning')
        return redirect(url_for('chat.detail', chat_id=chat_id))
    
    try:
        message = Message.create(
            chat=chat,
            sender=current_user,
            content=content or '',
            image_path=image_path
        )
        
        flash('メッセージを送信しました', 'success')
        return redirect(url_for('chat.detail', chat_id=chat_id))
    
    except Exception as e:
        flash(f'送信中にエラーが発生しました: {str(e)}', 'danger')
        return redirect(url_for('chat.detail', chat_id=chat_id))


@chat_bp.route('/<int:chat_id>/messages', methods=['GET'])
@login_required
def get_messages(chat_id):
    """メッセージ取得（ポーリング用API）"""
    chat = Chat.select().where(Chat.id == chat_id).first()
    
    if not chat:
        return jsonify({'error': 'チャットが見つかりません'}), 404
    
    # アクセス権限チェック
    participants = chat.get_participants()
    if current_user.id not in [participants['client'].id, participants['coach'].id]:
        return jsonify({'error': 'アクセス権限がありません'}), 403
    
    # 最後のメッセージIDから新しいメッセージを取得
    last_message_id = request.args.get('last_id', 0, type=int)
    
    messages = Message.select().where(
        (Message.chat == chat) & (Message.id > last_message_id)
    ).order_by(Message.sent_at.asc())
    
    return jsonify({
        'messages': [{
            'id': msg.id,
            'sender': msg.sender.username,
            'sender_id': msg.sender.id,
            'content': msg.content,
            'sent_at': msg.sent_at.strftime('%Y-%m-%d %H:%M:%S')
        } for msg in messages]
    })


@chat_bp.route('/message/<int:message_id>/delete', methods=['POST'])
@login_required
def delete_message(message_id):
    """メッセージ削除（送信取り消し）"""
    try:
        message = Message.get_by_id(message_id)
        
        # 送信者本人のみ削除可能
        sender_id = message.sender if isinstance(message.sender, int) else message.sender.id
        if sender_id != current_user.id:
            return jsonify({'success': False, 'error': '削除権限がありません'}), 403
        
        # 削除フラグを立てる（物理削除ではなく論理削除）
        message.is_deleted = 1
        message.deleted_at = datetime.now()
        message.save()
        
        return jsonify({'success': True})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
