"""
クライアント関連ルート
"""
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, send_from_directory, abort, current_app
from flask_login import login_required, current_user
from functools import wraps
from models.impression import DesiredFace, SkinCheck
from models.user import User
from models.daily_check import DailyCheck
from datetime import datetime, date
from utils.gemini_skin_analysis import analyze_skin_with_gemini

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
                         check_saved=check_saved,
                         user_gender=current_user.gender)


@client.route('/ai-skin-analysis', methods=['POST'])
@client_required
def ai_skin_analysis():
    """AI肌診断（Gemini Flash使用）"""
    try:
        # JSONデータを取得
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'error': True,
                'message': '画像データが必要です'
            }), 400
        
        image_data = data.get('image')
        
        # Gemini APIで診断
        print(f"[AI診断] ユーザー: {current_user.username}, 性別: {current_user.gender}")
        result = analyze_skin_with_gemini(
            image_data, 
            gender=current_user.gender
        )
        
        # エラーチェック
        if result.get('error'):
            print(f"[AI診断] エラー: {result.get('message')}")
            return jsonify(result), 500
        
        # データベースに保存
        try:
            skin_check = SkinCheck.create(
                user=current_user,
                skin_type=result['skin_type'],
                concerns=','.join(result['concerns']),
                ai_analyzed=1,  # AI診断済みフラグ
                ai_score=result['score'],
                ai_skin_age=result['skin_age'],
                ai_general_advice=result['general_advice'],
                ai_expert_advice=result['expert_advice']
            )
            print(f"[AI診断] 保存成功: ID={skin_check.id}")
            
            # レスポンスに保存IDを追加
            result['skin_check_id'] = skin_check.id
            result['saved'] = True
            
        except Exception as e:
            print(f"[AI診断] DB保存エラー: {str(e)}")
            result['saved'] = False
            result['save_error'] = str(e)
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"[AI診断] 予期しないエラー: {str(e)}")
        return jsonify({
            'error': True,
            'message': f'診断中にエラーが発生しました: {str(e)}'
        }), 500


# ========================================
# Step4-A: Export最小実装（JSON保存のみ）
# ========================================

@client.route('/api/face-template/export-minimal', methods=['POST'])
@client_required
def api_face_template_export_minimal():
    """
    Export実装（Step4-B: PNG生成追加）
    JSON保存 → PNG生成試行 → 失敗しても壊れない設計
    """
    import json
    import os
    import uuid
    from datetime import datetime
    from flask import current_app, url_for
    from models import FaceTemplate, FacePart
    from utils.render_engine import render_export
    
    data = request.get_json(silent=True) or {}
    template_id = data.get("template_id")
    anchors = data.get("anchors")
    state = data.get("state")
    parts_data = data.get("parts", {})  # {eyebrow_id, nose_id}
    
    if not template_id or not isinstance(anchors, dict) or not isinstance(state, dict):
        return jsonify({"ok": False, "error": "invalid_payload"}), 400
    
    # Template取得
    try:
        template = FaceTemplate.get_by_id(template_id)
        if template.user_id != current_user.id:
            return jsonify({"ok": False, "error": "permission_denied"}), 403
    except FaceTemplate.DoesNotExist:
        return jsonify({"ok": False, "error": "template_not_found"}), 404
    
    # Parts取得
    parts = {}
    eyebrow_id = parts_data.get("eyebrow_id")
    nose_id = parts_data.get("nose_id")
    
    if eyebrow_id:
        try:
            eyebrow = FacePart.get_by_id(eyebrow_id)
            parts["leftBrow"] = {"path": eyebrow.image_path}
            parts["rightBrow"] = {"path": eyebrow.image_path}
        except FacePart.DoesNotExist:
            pass
    
    if nose_id:
        try:
            nose = FacePart.get_by_id(nose_id)
            parts["nose"] = {"path": nose.image_path}
        except FacePart.DoesNotExist:
            pass
    
    # 保存先（Step4-B: EXPORT_DIRに統一）
    export_dir = current_app.config['FIRSTLOOK_EXPORT_DIR']
    os.makedirs(export_dir, exist_ok=True)
    
    export_id = uuid.uuid4().hex[:12]
    meta_path = os.path.join(export_dir, f"{export_id}.json")
    png_path = os.path.join(export_dir, f"{export_id}.png")
    
    # Step4-B: メタ情報拡張（base_image_path, parts追加）
    meta = {
        "export_id": export_id,
        "user_id": current_user.id,
        "template_id": template_id,
        "base_image_path": template.image_path,
        "anchors": anchors,
        "state": state,
        "parts": parts,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    
    # 1. JSON保存（必ず成功させる）
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    
    # 2. PNG生成を試行（失敗しても壊れない）
    png_generated = False
    png_error = None
    
    try:
        upload_dir = current_app.config['FIRSTLOOK_UPLOAD_DIR']
        render_export(meta, png_path, upload_dir)
        png_generated = True
        
        # PNG成功時はメタに追記（HTTP参照可能な相対パス）
        meta["png_path"] = f"exports/{export_id}.png"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
            
    except Exception as e:
        png_error = str(e)
        current_app.logger.exception(f"[Export] PNG生成失敗（exportは継続）: {e}")
    
    # 3. レスポンス（exportは常に成功）
    share_url = url_for("client.face_template_share", export_id=export_id, _external=False)
    
    return jsonify({
        "ok": True,
        "export_id": export_id,
        "share_url": share_url,
        "png_generated": png_generated,
        "png_error": png_error if not png_generated else None
    }), 200


@client.route('/share/face/<export_id>')
def face_template_share(export_id):
    """
    共有URL表示（Step4-B: 画像表示HTML・最短実装）
    """
    from flask import render_template_string
    import json
    import os
    
    export_dir = current_app.config['FIRSTLOOK_EXPORT_DIR']
    meta_path = os.path.join(export_dir, f"{export_id}.json")
    png_abs = os.path.join(export_dir, f"{export_id}.png")
    
    if not os.path.exists(meta_path):
        return "Not Found", 404
    
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    
    # PNG存在チェック
    png_url = None
    if os.path.exists(png_abs):
        png_url = f"/exports/{export_id}.png"
    
    # 再生成可能か（ログインユーザーが所有者の場合のみ）
    can_retry = current_user.is_authenticated and meta.get('user_id') == current_user.id
    
    # デバッグモード
    debug = request.args.get("debug") == "1"
    
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex, nofollow">
        <title>FirstLook Share - 成りたい顔</title>
        <style>
            * { box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                padding: 16px;
                max-width: 800px;
                margin: 0 auto;
                background: #f8f9fa;
            }
            .container {
                background: white;
                padding: 24px;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            h2 {
                margin-top: 0;
                color: #333;
                border-bottom: 2px solid #007bff;
                padding-bottom: 8px;
            }
            .image-wrap {
                margin: 20px 0;
                text-align: center;
            }
            .image-wrap img {
                max-width: 100%;
                height: auto;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            .no-image {
                background: #fff3cd;
                border: 1px solid #ffc107;
                padding: 16px;
                border-radius: 4px;
                margin: 20px 0;
            }
            button {
                background: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }
            button:hover { background: #0056b3; }
            button:disabled {
                background: #6c757d;
                cursor: not-allowed;
            }
            #msg {
                margin-top: 12px;
                padding: 8px;
                border-radius: 4px;
            }
            #msg.success {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            #msg.error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
            .debug-section {
                margin-top: 24px;
                padding: 16px;
                background: #f6f6f6;
                border-radius: 4px;
            }
            .debug-section h3 {
                margin-top: 0;
                font-size: 16px;
                color: #666;
            }
            pre {
                background: white;
                padding: 12px;
                overflow: auto;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 12px;
            }
            .link-btn {
                display: inline-block;
                margin-top: 8px;
                color: #007bff;
                text-decoration: none;
            }
            .link-btn:hover { text-decoration: underline; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>🎨 FirstLook - 成りたい顔</h2>
            
            {% if png_url %}
                <div class="image-wrap">
                    <img src="{{ png_url }}" alt="成りたい顔" />
                    <br>
                    <a href="{{ png_url }}" target="_blank" class="link-btn">📥 画像を開く</a>
                </div>
            {% else %}
                <div class="no-image">
                    <p><strong>⚠️ 画像未生成</strong></p>
                    <p>この共有画像はまだ生成されていません。</p>
                    {% if can_retry %}
                        <button id="retry">🔄 再生成</button>
                        <div id="msg"></div>
                        <script>
                          document.getElementById('retry').addEventListener('click', async () => {
                            const btn = document.getElementById('retry');
                            const msg = document.getElementById('msg');
                            btn.disabled = true;
                            btn.textContent = '生成中...';
                            msg.textContent = '';
                            msg.className = '';
                            
                            try {
                              const res = await fetch('/api/face-template/retry-render/{{ export_id }}', {method:'POST'});
                              const j = await res.json();
                              
                              if (j.ok) {
                                msg.textContent = '✅ 再生成しました。ページをリロードしてください。';
                                msg.className = 'success';
                                setTimeout(() => location.reload(), 1500);
                              } else {
                                msg.textContent = '❌ 失敗: ' + (j.error || '不明なエラー');
                                msg.className = 'error';
                                btn.disabled = false;
                                btn.textContent = '🔄 再生成';
                              }
                            } catch (err) {
                              msg.textContent = '❌ 通信エラー: ' + err.message;
                              msg.className = 'error';
                              btn.disabled = false;
                              btn.textContent = '🔄 再生成';
                            }
                          });
                        </script>
                    {% else %}
                        <p><small>※ 再生成は所有者のみ可能です</small></p>
                    {% endif %}
                </div>
            {% endif %}
            
            {% if debug %}
                <div class="debug-section">
                    <h3>🔍 Debug情報</h3>
                    <pre>{{ meta_json }}</pre>
                </div>
            {% endif %}
            
            <p style="margin-top: 24px; text-align: center; color: #6c757d; font-size: 14px;">
                Powered by <strong>FirstLook</strong>
            </p>
        </div>
    </body>
    </html>
    """
    
    return render_template_string(
        html,
        export_id=export_id,
        png_url=png_url,
        can_retry=can_retry,
        meta_json=json.dumps(meta, ensure_ascii=False, indent=2),
        debug=debug
    )


@client.route('/share/face/<export_id>/image')
def face_export_image(export_id):
    """
    Export画像を配信（後方互換用）
    """
    from flask import current_app, send_file
    import os
    
    export_dir = current_app.config['FIRSTLOOK_EXPORT_DIR']
    png_path = os.path.join(export_dir, f"{export_id}.png")
    
    if not os.path.exists(png_path):
        return "Image Not Found", 404
    
    return send_file(png_path, mimetype='image/png')


# ========================================
# Step4-B: Export画像配信（最短実装）
# ========================================

@client.route('/exports/<path:filename>')
def serve_exports(filename):
    """
    Export画像の静的配信
    
    ディレクトリトラバーサル対策を含む
    """
    # セキュリティチェック
    if '..' in filename or filename.startswith('/'):
        abort(400)
    
    export_dir = current_app.config['FIRSTLOOK_EXPORT_DIR']
    return send_from_directory(export_dir, filename)


# ========================================
# Step4-B: 再生成エンドポイント
# ========================================

@client.route('/api/face-template/retry-render/<export_id>', methods=['POST'])
@client_required
def api_retry_render(export_id):
    """
    PNG再生成エンドポイント
    JSONを読み直してPNG生成を再試行
    """
    import json
    import os
    from utils.render_engine import render_export
    
    export_dir = current_app.config['FIRSTLOOK_EXPORT_DIR']
    meta_path = os.path.join(export_dir, f"{export_id}.json")
    png_path = os.path.join(export_dir, f"{export_id}.png")
    
    # メタデータ読み込み
    if not os.path.exists(meta_path):
        return jsonify({"ok": False, "error": "meta_not_found"}), 404
    
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    
    # 権限チェック（所有者のみ）
    if meta.get('user_id') != current_user.id:
        return jsonify({"ok": False, "error": "permission_denied"}), 403
    
    # PNG再生成
    try:
        upload_dir = current_app.config['FIRSTLOOK_UPLOAD_DIR']
        render_export(meta, png_path, upload_dir)
        
        # メタ更新（HTTP参照可能な相対パス）
        meta["png_path"] = f"exports/{export_id}.png"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        
        return jsonify({"ok": True}), 200
        
    except Exception as e:
        current_app.logger.exception("retry-render failed")
        # 500ではなく200で返す（フロントで判断可能に）
        return jsonify({"ok": False, "error": str(e)}), 200
