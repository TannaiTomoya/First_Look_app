"""
顔テンプレート・パーツ関連ルート
"""
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from models.face_template import FaceTemplate, FacePart, FaceComposition
from models.impression import DesiredFace
from utils.uploads import save_image, get_upload_subdir, InvalidImageFormatError, InvalidImageDataError
from datetime import datetime
import os
import traceback

face_template = Blueprint('face_template', __name__, url_prefix='/client/face-template')


@face_template.route('/capture')
@login_required
def capture():
    """顔写真撮影ページ"""
    return render_template('face_template/capture.html')


@face_template.route('/save-base-image', methods=['POST'])
@login_required
def save_base_image():
    """ベース画像を保存"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        # 新しいアップロードユーティリティを使用
        try:
            subdir = get_upload_subdir('face_templates')
            image_path = save_image(file, subdir, max_size=1080, quality=85)
        except InvalidImageFormatError as e:
            return jsonify({'error': f'画像形式エラー: {str(e)}'}), 400
        except InvalidImageDataError as e:
            return jsonify({'error': f'画像データエラー: {str(e)}'}), 400
        
        # データベースに保存
        # impression は現時点では null（後から紐付け機能を追加可能）
        template = FaceTemplate.create(
            user=current_user,
            impression=None,
            base_image_path=image_path
        )
        
        # onboardingクエリを引き継ぐ
        onboarding_param = request.args.get('onboarding')
        redirect_url = url_for('face_template.preview', template_id=template.id)
        if onboarding_param:
            redirect_url += f'?onboarding={onboarding_param}'
        
        return jsonify({
            'success': True,
            'template_id': template.id,
            'redirect_url': redirect_url
        })
    
    except Exception as e:
        # エラーの詳細をログに出力
        print(f"Error in save_base_image: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f'保存に失敗しました: {str(e)}'}), 500


@face_template.route('/preview/<int:template_id>')
@login_required
def preview(template_id):
    """プレビュー・合成ページ"""
    # テンプレート取得
    template = FaceTemplate.get_or_none(FaceTemplate.id == template_id)
    if not template:
        flash('テンプレートが見つかりません', 'error')
        return redirect(url_for('client.dashboard'))
    
    # ユーザーIDを解決して確認
    template_user = template.user
    if isinstance(template_user, int):
        from models.user import User
        template_user = User.get_by_id(template_user)
    
    if template_user.id != current_user.id:
        flash('テンプレートが見つかりません', 'error')
        return redirect(url_for('client.dashboard'))
    
    # onboarding=1の悪用防止：既存ユーザーは無効化
    from models.look_record import LookRecord
    is_onboarding = request.args.get('onboarding') == '1'
    if is_onboarding:
        # 既にLookRecordが存在する場合は通常モードに強制
        has_record = LookRecord.select().where(LookRecord.user_id == current_user.id).exists()
        if has_record:
            is_onboarding = False
    
    # パーツ取得
    eyebrows = FacePart.select().where(FacePart.part_type == 'eyebrow').order_by(FacePart.id)
    noses = FacePart.select().where(FacePart.part_type == 'nose').order_by(FacePart.id)
    
    # 既存の合成があれば取得
    composition = FaceComposition.get_or_none(
        FaceComposition.user == current_user.id,
        FaceComposition.template == template_id
    )
    
    # compositionがある場合、関連を解決
    if composition:
        if composition.eyebrow_part:
            eyebrow_part_id = composition.eyebrow_part
            if isinstance(eyebrow_part_id, int):
                composition.eyebrow_part = FacePart.get_by_id(eyebrow_part_id)
        
        if composition.nose_part:
            nose_part_id = composition.nose_part
            if isinstance(nose_part_id, int):
                composition.nose_part = FacePart.get_by_id(nose_part_id)
    
    return render_template(
        'face_template/preview.html',
        template=template,
        eyebrows=eyebrows,
        noses=noses,
        composition=composition,
        is_onboarding=is_onboarding
    )


@face_template.route('/save-composition', methods=['POST'])
@login_required
def save_composition():
    """パーツ選択を保存"""
    try:
        data = request.get_json()
        template_id = data.get('template_id')
        eyebrow_id = data.get('eyebrow_id')
        nose_id = data.get('nose_id')
        
        if not template_id:
            return jsonify({'error': 'Template ID required'}), 400
        
        # 既存の合成があれば更新、なければ作成
        composition = FaceComposition.get_or_none(
            FaceComposition.user == current_user.id,
            FaceComposition.template == template_id
        )
        
        if composition:
            composition.eyebrow_part = eyebrow_id
            composition.nose_part = nose_id
            composition.updated_at = datetime.now()
            composition.save()
        else:
            composition = FaceComposition.create(
                user=current_user,
                template=template_id,
                eyebrow_part=eyebrow_id,
                nose_part=nose_id
            )
        
        return jsonify({'success': True, 'composition_id': composition.id})
    
    except Exception as e:
        print(f"Error in save_composition: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f'保存に失敗しました: {str(e)}'}), 500


@face_template.route('/parts')
@login_required
def view_parts():
    """パーツ一覧表示（簡易版）"""
    # 眉パーツを取得
    eyebrows = FacePart.select().where(FacePart.part_type == 'eyebrow').order_by(FacePart.id)
    
    # 鼻パーツを取得
    noses = FacePart.select().where(FacePart.part_type == 'nose').order_by(FacePart.id)
    
    return render_template(
        'face_template/parts.html',
        eyebrows=eyebrows,
        noses=noses
    )
