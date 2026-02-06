"""
高品質レンダリングエクスポートAPI（Step4）
"""
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from models.render_export import RenderExport
from models.face_template import FaceTemplate, FacePart
from utils.render_engine import RenderEngine
from datetime import datetime, timedelta
import json
import traceback
import os

api_export = Blueprint('api_export', __name__, url_prefix='/api/face-template')

# 連打対策：最後のexport時刻を保持
last_export_times = {}
EXPORT_COOLDOWN = 5  # 秒


@api_export.route('/export', methods=['POST'])
@login_required
def create_export():
    """高品質レンダリングを作成"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'ok': False, 'error': 'データが必要です'}), 400
        
        template_id = data.get('template_id')
        state = data.get('state')
        anchors = data.get('anchors')
        selected_parts = data.get('parts', {})  # Step4: 選択されたパーツID
        output_format = data.get('format', 'PNG').upper()
        
        # バリデーション
        if not template_id:
            return jsonify({'ok': False, 'error': 'template_idが必要です'}), 400
        
        if not state or not isinstance(state, dict):
            return jsonify({'ok': False, 'error': 'stateが必要です'}), 400
        
        if not anchors or not isinstance(anchors, dict):
            return jsonify({'ok': False, 'error': 'anchorsが必要です'}), 400
        
        if not selected_parts:
            return jsonify({'ok': False, 'error': 'パーツが選択されていません'}), 400
        
        if output_format not in ['PNG', 'JPEG']:
            output_format = 'PNG'
        
        # 連打対策
        user_key = f'user_{current_user.id}'
        now = datetime.now()
        
        if user_key in last_export_times:
            elapsed = (now - last_export_times[user_key]).total_seconds()
            if elapsed < EXPORT_COOLDOWN:
                return jsonify({
                    'ok': False,
                    'error': f'連続実行はできません。{EXPORT_COOLDOWN - int(elapsed)}秒後に再試行してください'
                }), 429
        
        last_export_times[user_key] = now
        
        # テンプレートの所有権確認
        template = FaceTemplate.get_or_none(FaceTemplate.id == template_id)
        if not template:
            return jsonify({'ok': False, 'error': 'テンプレートが見つかりません'}), 404
        
        # ユーザーIDを解決
        template_user_id = template.user if isinstance(template.user, int) else template.user.id
        
        if template_user_id != current_user.id:
            return jsonify({'ok': False, 'error': '権限がありません'}), 403
        
        # stateのバリデーション
        if 'parts' not in state:
            return jsonify({'ok': False, 'error': 'state.partsが必要です'}), 400
        
        # anchorsのバリデーション（Step4: x,y形式に対応）
        required_anchors = ['leftBrow', 'rightBrow', 'nose']
        for anchor_key in required_anchors:
            if anchor_key not in anchors:
                return jsonify({'ok': False, 'error': f'anchors.{anchor_key}が必要です'}), 400
            
            anchor = anchors[anchor_key]
            
            # x,y形式とcx,cy形式の両方に対応
            if 'x' in anchor and 'y' in anchor:
                # x,y形式 → cx,cy形式に変換
                anchor['cx'] = anchor['x']
                anchor['cy'] = anchor['y']
            
            if not all(k in anchor for k in ['cx', 'cy', 'w', 'h']):
                return jsonify({'ok': False, 'error': f'anchors.{anchor_key}にcx,cy,w,hまたはx,y,w,hが必要です'}), 400
            
            # 画像外チェック（clamp）
            anchor['cx'] = max(0, min(anchor['cx'], 5000))  # 最大5000px想定
            anchor['cy'] = max(0, min(anchor['cy'], 5000))
            anchor['w'] = max(1, min(anchor['w'], 1000))
            anchor['h'] = max(1, min(anchor['h'], 1000))
        
        # パーツ情報を取得（ユーザー選択を使用）
        parts = {}
        
        # 眉パーツ
        eyebrow_id = selected_parts.get('eyebrow_id')
        if eyebrow_id:
            eyebrow_part = FacePart.get_or_none(FacePart.id == eyebrow_id)
            if eyebrow_part:
                parts['leftBrow'] = {'path': eyebrow_part.image_url}
                parts['rightBrow'] = {'path': eyebrow_part.image_url}
        
        # 鼻パーツ
        nose_id = selected_parts.get('nose_id')
        if nose_id:
            nose_part = FacePart.get_or_none(FacePart.id == nose_id)
            if nose_part:
                parts['nose'] = {'path': nose_part.image_url}
        
        if not parts:
            return jsonify({'ok': False, 'error': 'パーツが見つかりません'}), 400
        
        # stateの形式を変換（RenderState形式 → engine形式）
        engine_state = _convert_state_format(state)
        
        # レンダリングエンジン初期化
        upload_dir = current_app.config['FIRSTLOOK_UPLOAD_DIR']
        engine = RenderEngine(upload_dir)
        
        # 画像を合成
        try:
            rendered_image = engine.render(
                base_image_path=template.base_image_path,
                parts=parts,
                state=engine_state,
                anchors=anchors,
                output_format=output_format
            )
        except Exception as e:
            print(f'[Export] レンダリングエラー: {str(e)}')
            print(traceback.format_exc())
            return jsonify({'ok': False, 'error': f'レンダリングに失敗しました: {str(e)}'}), 500
        
        # share_token生成
        share_token = RenderExport.generate_share_token()
        
        # 仮のexport_id（DBに保存前なので、一時的にタイムスタンプを使用）
        temp_export_id = int(datetime.now().timestamp() * 1000)
        
        # 画像を保存
        try:
            output_path = engine.save_export(
                image=rendered_image,
                user_id=current_user.id,
                export_id=temp_export_id,
                format=output_format
            )
        except Exception as e:
            print(f'[Export] 画像保存エラー: {str(e)}')
            print(traceback.format_exc())
            return jsonify({'ok': False, 'error': f'画像保存に失敗しました: {str(e)}'}), 500
        
        # DBに保存
        try:
            export = RenderExport.create(
                user=current_user.id,
                template=template_id,
                state_json=json.dumps(state),
                output_path=output_path,
                share_token=share_token,
                is_public=True  # デフォルトで公開
            )
            
            # 実際のexport_idでファイル名を変更
            old_file_path = os.path.join(upload_dir, output_path)
            new_filename = f'{export.id}.{"png" if output_format == "PNG" else "jpg"}'
            new_output_path = os.path.join('exports', str(current_user.id), new_filename)
            new_file_path = os.path.join(upload_dir, new_output_path)
            
            os.rename(old_file_path, new_file_path)
            
            # DBのパスも更新
            export.output_path = new_output_path
            export.save()
            
            print(f'[Export] 作成成功: export_id={export.id}, user={current_user.id}, token={share_token}')
            
            return jsonify({
                'ok': True,
                'export_id': export.id,
                'share_url': f'/share/{share_token}',
                'share_token': share_token
            }), 200
            
        except Exception as e:
            print(f'[Export] DB保存エラー: {str(e)}')
            print(traceback.format_exc())
            
            # 失敗したら画像も削除
            try:
                os.remove(old_file_path)
            except:
                pass
            
            return jsonify({'ok': False, 'error': f'DB保存に失敗しました: {str(e)}'}), 500
        
    except Exception as e:
        print(f'[Export] 予期しないエラー: {str(e)}')
        print(traceback.format_exc())
        return jsonify({'ok': False, 'error': f'エクスポートに失敗しました: {str(e)}'}), 500


def _convert_state_format(state):
    """
    stateの形式を変換（柔軟に対応）
    RenderState形式（eyebrow.left/right）→ engine形式（leftBrow/rightBrow）
    """
    # Step2形式（parts.leftBrow）の場合はそのまま使用
    if 'parts' in state and 'leftBrow' in state['parts']:
        return state
    
    # RenderState形式（eyebrow.left）の場合は変換
    if 'eyebrow' in state:
        return {
            'parts': {
                'leftBrow': state['eyebrow'].get('left', {}),
                'rightBrow': state['eyebrow'].get('right', {}),
                'nose': state.get('nose', {})
            }
        }
    
    # デフォルト
    return state
