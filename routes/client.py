"""
クライアント関連ルート
"""

from flask import (
    Blueprint,
    render_template,
    redirect,
    url_for,
    flash,
    request,
    jsonify,
    send_from_directory,
    abort,
    current_app,
)
from flask_login import login_required, current_user
from functools import wraps
from models.impression import DesiredFace, SkinCheck
from models.user import User
from datetime import datetime, date, timedelta
import calendar
from models.daily_check import DailyCheck
from models.look_record import LookRecord
from models.daily_action import DailyAction
from datetime import datetime, date, timedelta
from utils.gemini_skin_analysis import analyze_skin_with_gemini
from utils.look_score import compute_look_scores
from utils.daily_actions import get_random_action, get_action_by_key
from utils.progress_card import generate_progress_card
from utils.weekly_summary import build_weekly_comment, choose_next_focus
from utils.look_streak import (
    calculate_current_streak_with_freeze,
    calculate_longest_streak,
    has_record_today,
    consume_freeze_if_needed,
)
import base64
import os
from PIL import Image
import io
from itertools import groupby

client = Blueprint("client", __name__, url_prefix="/client")

# ダッシュボード表示制御フラグ
HIDE_TOOLS_UNTIL_RECORDED = True


def client_required(f):
    """クライアント専用デコレーター"""

    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if not current_user.is_client():
            # AJAXリクエストの場合はJSON形式で返す
            if request.is_json or request.headers.get("Content-Type") == "application/json":
                return jsonify({"ok": False, "error": "client_only"}), 403
            flash("この機能はクライアントのみ利用できます", "warning")
            return redirect(url_for("index"))
        return f(*args, **kwargs)

    return decorated_function


@client.route("/onboarding")
@client_required
def onboarding():
    """オンボーディング（初回体験）"""
    # 既にLookRecordがあればダッシュボードへ
    has_record = LookRecord.select().where(LookRecord.user_id == current_user.id).exists()
    if has_record:
        return redirect(url_for("client.dashboard"))

    return render_template("client/onboarding.html")


@client.route("/onboarding/done")
@client_required
def onboarding_done():
    """オンボーディング完了画面"""
    return render_template("client/onboarding_done.html")


@client.route("/dashboard")
@client_required
def dashboard():
    """クライアントダッシュボード"""
    # オンボーディングチェック（最初のLookRecordが無ければリダイレクト）
    has_record = LookRecord.select().where(LookRecord.user_id == current_user.id).exists()
    if not has_record:
        return redirect(url_for("client.onboarding"))

    # 肌質・悩みの変換辞書（英語 → 日本語 + 画像パス）
    skin_type_map = {
        "dry": {"label": "乾燥肌", "image": "images/skin_types/dry_skin.jpg"},
        "oily": {"label": "脂性肌", "image": "images/skin_types/oily_skin.jpg"},
        "combination": {"label": "混合肌", "image": "images/skin_types/combination_skin.jpg"},
        "normal": {"label": "普通肌", "image": "images/skin_types/normal_skin.jpg"},
    }

    concerns_map = {
        "pores": {"label": "毛穴の開き", "image": "images/skin_concerns/pores.jpg"},
        "dark_spots": {"label": "黒ずみ", "image": "images/skin_concerns/dark_spots.jpg"},
        "tone": {"label": "肌トーンの不均一", "image": "images/skin_concerns/tone.jpg"},
        "acne": {"label": "ニキビケア", "image": "images/skin_concerns/acne.jpg"},
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
    latest_skin_check = (
        SkinCheck.select()
        .where(SkinCheck.user == current_user.id)
        .order_by(SkinCheck.created_at.desc())
        .first()
    )

    # 肌診断データを整形（画像と日本語表示用）
    skin_check_data = None
    if latest_skin_check:
        # 悩みをカンマ区切りで分割して、各悩みの情報を取得
        concerns_list = []
        if latest_skin_check.concerns:
            for concern_key in latest_skin_check.concerns.split(","):
                concern_key = concern_key.strip()
                if concern_key and concern_key in concerns_map:
                    concerns_list.append(concerns_map[concern_key])

        skin_check_data = {
            "skin_type": skin_type_map.get(latest_skin_check.skin_type, {}),
            "concerns": concerns_list,
            "created_at": latest_skin_check.created_at,
        }

    # 今日のチェック
    today_check = (
        DailyCheck.select()
        .where((DailyCheck.user == current_user.id) & (DailyCheck.check_date == date.today()))
        .first()
    )

    # Freeze自動消費チェック（記録がない日にFreezeを使用）
    consume_freeze_if_needed(current_user)

    # LookRecordストリーク（Freeze考慮版）
    current_streak = calculate_current_streak_with_freeze(current_user)
    longest_streak = calculate_longest_streak(current_user.id)
    has_today_record = has_record_today(current_user.id)

    # Freeze使用チェック（今日使用されたか）
    freeze_used_today = (
        not has_today_record and current_user.last_freeze_used_at == date.today()
    )

    # 達成バッジ取得（Phase D4）
    from utils.achievement import get_user_achievements
    achievements = get_user_achievements(current_user)

    # 昨日からの変化を計算
    yesterday = date.today() - timedelta(days=1)
    yesterday_record = (
        LookRecord.select()
        .where((LookRecord.user_id == current_user.id) & (LookRecord.date == yesterday))
        .first()
    )
    today_record = (
        LookRecord.select()
        .where((LookRecord.user_id == current_user.id) & (LookRecord.date == date.today()))
        .first()
    )
    
    # 変化量を計算（今日 - 昨日）
    score_change = None
    if today_record and yesterday_record and today_record.score_total and yesterday_record.score_total:
        score_change = today_record.score_total - yesterday_record.score_total

    # Day0と最新の記録を取得（変化カード用）
    day0_record = (
        LookRecord.select()
        .where(LookRecord.user_id == current_user.id)
        .order_by(LookRecord.date.asc())
        .first()
    )
    latest_record = (
        LookRecord.select()
        .where(LookRecord.user_id == current_user.id)
        .order_by(LookRecord.date.desc())
        .first()
    )
    
    # Day0からの変化量を計算
    day0_progress = None
    if day0_record and latest_record and day0_record.id != latest_record.id:
        if day0_record.score_total and latest_record.score_total:
            day0_progress = latest_record.score_total - day0_record.score_total

    # 初回ユーザー判定（記録が1件のみ）
    record_count = LookRecord.select().where(LookRecord.user_id == current_user.id).count()
    is_first_day = (record_count == 1)

    # Daily CTA（Day1〜Day30専用）
    from utils.onboarding_copy import get_day_index, get_daily_cta_copy
    day_index = None
    daily_cta_copy = None
    if day0_record:
        day_index = get_day_index(day0_record.date, date.today())
        daily_cta_copy = get_daily_cta_copy(day_index)

    # フォーカスモード判定（未記録時は集中モード）
    tools_override = request.args.get("tools") == "1"
    show_focus_mode = (
        HIDE_TOOLS_UNTIL_RECORDED
        and not has_today_record
        and not tools_override
    )

    # Focus Mode表示イベント記録
    if show_focus_mode:
        try:
            from utils.event_logger import log_event
            log_event(current_user, "dashboard_focus_shown")
        except:
            pass  # サイレントエラー

    return render_template(
        "client/dashboard.html",
        selected_impression=selected_impression,
        latest_skin_check=latest_skin_check,
        skin_check_data=skin_check_data,
        today_check=today_check,
        current_streak=current_streak,
        longest_streak=longest_streak,
        has_today_record=has_today_record,
        freeze_used_today=freeze_used_today,
        achievements=achievements,
        hide_scores=current_user.hide_scores,
        score_change=score_change,
        day0_record=day0_record,
        latest_record=latest_record,
        day0_progress=day0_progress,
        is_first_day=is_first_day,
        day_index=day_index,
        daily_cta_copy=daily_cta_copy,
        show_focus_mode=show_focus_mode,
    )


@client.route("/impression/select", methods=["GET", "POST"])
@client_required
def select_impression():
    """印象カード選択"""
    faces = DesiredFace.select().order_by(DesiredFace.id.asc())

    if request.method == "POST":
        try:
            face_id = request.form.get("desired_face_id")
            if face_id:
                face = DesiredFace.select().where(DesiredFace.id == int(face_id)).first()
                if face:
                    current_user.desired_face = face
                    current_user.save()
                    flash("印象カードを選択しました", "success")
                else:
                    flash("選択された印象カードが見つかりません", "danger")
            else:
                flash("印象カードを選択してください", "warning")
            return redirect(url_for("client.dashboard"))
        except Exception as e:
            flash(f"選択中にエラーが発生しました: {str(e)}", "danger")

    return render_template("client/select_impression.html", faces=faces)


@client.route("/skin-check", methods=["GET", "POST"])
@client_required
def skin_check():
    """肌診断フォーム"""
    if request.method == "POST":
        try:
            skin_type = request.form.get("skin_type")
            concerns = ",".join(request.form.getlist("concerns"))

            SkinCheck.create(user=current_user, skin_type=skin_type, concerns=concerns)

            flash("肌診断を保存しました", "success")
            return redirect(url_for("client.dashboard"))
        except Exception as e:
            flash(f"保存中にエラーが発生しました: {str(e)}", "danger")

    # 最新の肌診断を取得
    latest_check = (
        SkinCheck.select()
        .where(SkinCheck.user == current_user.id)
        .order_by(SkinCheck.created_at.desc())
        .first()
    )

    return render_template("client/skin_check.html", latest_check=latest_check)


@client.route("/daily-check", methods=["GET", "POST"])
@client_required
def daily_check():
    """当日5分チェック"""
    # 今日のチェックを取得
    today = date.today()
    today_check = (
        DailyCheck.select()
        .where((DailyCheck.user == current_user.id) & (DailyCheck.check_date == today))
        .first()
    )

    # 保存完了フラグ
    check_saved = False

    if request.method == "POST":
        try:
            if today_check:
                # 更新
                today_check.eyebrow_ok = int(request.form.get("eyebrow_ok", 0))
                today_check.eye_ok = int(request.form.get("eye_ok", 0))
                today_check.nose_ok = int(request.form.get("nose_ok", 0))
                today_check.skin_ok = int(request.form.get("skin_ok", 0))
                today_check.lip_ok = int(request.form.get("lip_ok", 0))
                today_check.notes = request.form.get("notes", "")
                today_check.save()
            else:
                # 新規作成
                today_check = DailyCheck.create(
                    user=current_user,
                    check_date=today,
                    eyebrow_ok=int(request.form.get("eyebrow_ok", 0)),
                    eye_ok=int(request.form.get("eye_ok", 0)),
                    nose_ok=int(request.form.get("nose_ok", 0)),
                    skin_ok=int(request.form.get("skin_ok", 0)),
                    lip_ok=int(request.form.get("lip_ok", 0)),
                    notes=request.form.get("notes", ""),
                )

            check_saved = True
            flash("チェックを保存しました", "success")

        except Exception as e:
            flash(f"保存中にエラーが発生しました: {str(e)}", "danger")

    return render_template(
        "client/daily_check.html",
        today_check=today_check,
        check_saved=check_saved,
        user_gender=current_user.gender,
    )


@client.route("/ai-skin-analysis", methods=["POST"])
@client_required
def ai_skin_analysis():
    """AI肌診断（Gemini Flash使用）"""
    try:
        # JSONデータを取得
        data = request.get_json()

        if not data or "image" not in data:
            return jsonify({"error": True, "message": "画像データが必要です"}), 400

        image_data = data.get("image")

        # Gemini APIで診断
        print(f"[AI診断] ユーザー: {current_user.username}, 性別: {current_user.gender}")
        result = analyze_skin_with_gemini(image_data, gender=current_user.gender)

        # エラーチェック
        if result.get("error"):
            print(f"[AI診断] エラー: {result.get('message')}")
            return jsonify(result), 500

        # データベースに保存
        try:
            skin_check = SkinCheck.create(
                user=current_user,
                skin_type=result["skin_type"],
                concerns=",".join(result["concerns"]),
                ai_analyzed=1,  # AI診断済みフラグ
                ai_score=result["score"],
                ai_skin_age=result["skin_age"],
                ai_general_advice=result["general_advice"],
                ai_expert_advice=result["expert_advice"],
            )
            print(f"[AI診断] 保存成功: ID={skin_check.id}")

            # レスポンスに保存IDを追加
            result["skin_check_id"] = skin_check.id
            result["saved"] = True

        except Exception as e:
            print(f"[AI診断] DB保存エラー: {str(e)}")
            result["saved"] = False
            result["save_error"] = str(e)

        return jsonify(result), 200

    except Exception as e:
        print(f"[AI診断] 予期しないエラー: {str(e)}")
        return jsonify({"error": True, "message": f"診断中にエラーが発生しました: {str(e)}"}), 500


@client.route("/future-face/simulator")
@client_required
def future_face_simulator():
    """Future Face シミュレーター（理想の顔をイメージ）"""
    # Day0画像を取得
    day0_record = (
        LookRecord.select()
        .where((LookRecord.user_id == current_user.id) & (LookRecord.is_day0 == True))
        .first()
    )
    
    # 最新の記録を取得
    latest_record = (
        LookRecord.select()
        .where(LookRecord.user_id == current_user.id)
        .order_by(LookRecord.date.desc())
        .first()
    )
    
    return render_template(
        "client/future_face_simulator.html",
        day0_record=day0_record,
        latest_record=latest_record,
    )


@client.route("/api/future-face/apply", methods=["POST"])
@client_required
def apply_future_face_api():
    """Future Face効果をサーバーサイドで適用"""
    try:
        from utils.future_face_processor import get_processor
        
        # リクエストデータを取得
        data = request.get_json()
        
        if not data or "image_base64" not in data:
            return jsonify({
                "ok": False,
                "error": "画像データが必要です"
            }), 400
        
        image_base64 = data.get("image_base64")
        preset = data.get("preset", "all")  # all, slim, skin, young
        strength = data.get("strength", 40)  # 0-100
        
        # バリデーション
        if preset not in ["all", "slim", "skin", "young"]:
            return jsonify({
                "ok": False,
                "error": "無効なプリセットです"
            }), 400
        
        if not isinstance(strength, (int, float)) or strength < 0 or strength > 100:
            return jsonify({
                "ok": False,
                "error": "強度は0-100の範囲で指定してください"
            }), 400
        
        # プロセッサを取得して処理実行
        processor = get_processor()
        result = processor.apply_future_face(
            base64_image=image_base64,
            preset=preset,
            strength=int(strength)
        )
        
        # 結果を返す
        if result["ok"]:
            print(f"[Future Face] 処理成功: {result['processing_time_ms']}ms, preset={preset}, strength={strength}")
            return jsonify(result), 200
        else:
            print(f"[Future Face] 処理失敗: {result.get('error')}")
            return jsonify(result), 400
    
    except Exception as e:
        print(f"[Future Face] 予期しないエラー: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "error": f"サーバーエラー: {str(e)}"
        }), 500


# ========================================
# Step4-A: Export最小実装（JSON保存のみ）
# ========================================


@client.route("/api/face-template/export-minimal", methods=["POST"])
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

    try:
        data = request.get_json(silent=True) or {}
        template_id = data.get("template_id")
        anchors = data.get("anchors")
        state = data.get("state")
        parts_data = data.get("parts", {})  # {eyebrow_id, nose_id}

        # デバッグログ（詳細）
        current_app.logger.info(f"[Export-Minimal] リクエスト受信:")
        current_app.logger.info(f"  template_id: {template_id} (type: {type(template_id)})")
        current_app.logger.info(f"  anchors: {anchors} (type: {type(anchors)})")
        current_app.logger.info(f"  state: {state} (type: {type(state)})")
        current_app.logger.info(f"  parts_data: {parts_data} (type: {type(parts_data)})")
        current_app.logger.info(f"  raw_data: {data}")

        # 詳細な検証ログ
        if not template_id:
            current_app.logger.error(f"[Export-Minimal] Validation failed: template_id is missing or falsy")
            return jsonify({"ok": False, "error": "template_id is required"}), 400

        if not isinstance(anchors, dict):
            current_app.logger.error(
                f"[Export-Minimal] Validation failed: anchors is not dict (type: {type(anchors)})"
            )
            return jsonify({"ok": False, "error": "anchors must be a dict"}), 400

        if not isinstance(state, dict):
            current_app.logger.error(
                f"[Export-Minimal] Validation failed: state is not dict (type: {type(state)})"
            )
            return jsonify({"ok": False, "error": "state must be a dict"}), 400

        # Template取得
        try:
            template = FaceTemplate.get_by_id(template_id)

            # userフィールドの解決
            template_user_id = template.user if isinstance(template.user, int) else template.user.id

            if template_user_id != current_user.id:
                return jsonify({"ok": False, "error": "permission_denied"}), 403

            current_app.logger.info(
                f"[Export-Minimal] Template取得成功: {template.id}, base_image_path: {template.base_image_path}"
            )
        except FaceTemplate.DoesNotExist:
            return jsonify({"ok": False, "error": "template_not_found"}), 404
        except Exception as e:
            current_app.logger.error(f"[Export] Template取得エラー: {str(e)}")
            import traceback

            current_app.logger.error(traceback.format_exc())
            return jsonify({"ok": False, "error": f"template_error: {str(e)}"}), 500

        # Parts取得
        parts = {}
        eyebrow_id = parts_data.get("eyebrow_id")
        nose_id = parts_data.get("nose_id")

        if eyebrow_id:
            try:
                eyebrow = FacePart.get_by_id(eyebrow_id)
                # image_urlフィールドを使用
                parts["leftBrow"] = {"path": eyebrow.image_url}
                parts["rightBrow"] = {"path": eyebrow.image_url}
                current_app.logger.info(
                    f"[Export-Minimal] 眉パーツ取得: {eyebrow.label}, path: {eyebrow.image_url}"
                )
            except FacePart.DoesNotExist:
                current_app.logger.warning(f"[Export] 眉パーツが見つかりません: {eyebrow_id}")
                pass
            except Exception as e:
                current_app.logger.error(f"[Export] 眉パーツ取得エラー: {str(e)}")

        if nose_id:
            try:
                nose = FacePart.get_by_id(nose_id)
                # image_urlフィールドを使用
                parts["nose"] = {"path": nose.image_url}
                current_app.logger.info(
                    f"[Export-Minimal] 鼻パーツ取得: {nose.label}, path: {nose.image_url}"
                )
            except FacePart.DoesNotExist:
                current_app.logger.warning(f"[Export] 鼻パーツが見つかりません: {nose_id}")
                pass
            except Exception as e:
                current_app.logger.error(f"[Export] 鼻パーツ取得エラー: {str(e)}")

        # 保存先（Step4-B: EXPORT_DIRに統一）
        export_dir = current_app.config["FIRSTLOOK_EXPORT_DIR"]
        os.makedirs(export_dir, exist_ok=True)

        export_id = uuid.uuid4().hex[:12]
        meta_path = os.path.join(export_dir, f"{export_id}.json")
        png_path = os.path.join(export_dir, f"{export_id}.png")

        # Step4-B: メタ情報拡張（base_image_path, parts追加）
        meta = {
            "export_id": export_id,
            "user_id": current_user.id,
            "template_id": template_id,
            "base_image_path": template.base_image_path,  # 修正: image_path → base_image_path
            "anchors": anchors,
            "state": state,
            "parts": parts,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }

        current_app.logger.info(f"[Export-Minimal] メタ情報: {meta}")

        # 1. JSON保存（必ず成功させる）
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        # 2. PNG生成を試行（失敗しても壊れない）
        png_generated = False
        png_error = None
        db_saved = False
        share_token = None

        try:
            upload_dir = current_app.config["FIRSTLOOK_UPLOAD_DIR"]
            current_app.logger.info(f"[Export-Minimal] PNG生成開始: {png_path}")
            render_export(meta, png_path, upload_dir)
            png_generated = True
            current_app.logger.info(f"[Export-Minimal] PNG生成成功")

            # PNG成功時はメタに追記（HTTP参照可能な相対パス）
            relative_png_path = f"exports/{export_id}.png"
            meta["png_path"] = relative_png_path
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)

            # データベースに保存（RenderExportテーブル）
            try:
                from models.render_export import RenderExport

                share_token = RenderExport.generate_share_token()

                export_record = RenderExport.create(
                    user=current_user.id,
                    template=template_id,
                    state_json=json.dumps(state),
                    output_path=relative_png_path,
                    share_token=share_token,
                    is_public=True,
                )

                db_saved = True
                current_app.logger.info(
                    f"[Export-Minimal] DB保存成功: export_id={export_record.id}, token={share_token}"
                )

            except Exception as db_err:
                current_app.logger.error(f"[Export-Minimal] DB保存失敗: {str(db_err)}")
                import traceback

                current_app.logger.error(traceback.format_exc())

        except Exception as e:
            png_error = str(e)
            current_app.logger.exception(f"[Export] PNG生成失敗（exportは継続）: {e}")

        # 3. レスポンス（exportは常に成功）
        # デフォルトのshare_url
        share_url = url_for("client.face_template_share", export_id=export_id, _external=False)

        response_data = {
            "ok": True,
            "export_id": export_id,
            "share_url": share_url,
            "png_generated": png_generated,
            "png_error": png_error if not png_generated else None,
            "db_saved": db_saved,
        }

        # DB保存が成功していれば、share_tokenを使ったURLに変更
        if db_saved and share_token:
            response_data["share_url"] = url_for("share.view_export", token=share_token, _external=False)
            response_data["share_token"] = share_token

        return jsonify(response_data), 200

    except Exception as e:
        current_app.logger.exception(f"[Export-Minimal] 予期しないエラー: {e}")
        return jsonify({"ok": False, "error": f"internal_error: {str(e)}"}), 500


@client.route("/api/face-template/adjustments/save", methods=["POST"])
@client_required
def api_save_adjustments():
    """
    微調整の状態を保存
    """
    import json

    data = request.get_json(silent=True) or {}
    template_id = data.get("template_id")
    state = data.get("state")

    if not template_id or not isinstance(state, dict):
        return jsonify({"ok": False, "error": "invalid_payload"}), 400

    try:
        from models import FaceTemplate, FaceComposition

        # Template確認
        template = FaceTemplate.get_by_id(template_id)
        if template.user_id != current_user.id:
            return jsonify({"ok": False, "error": "permission_denied"}), 403

        # FaceCompositionにJSON形式で保存
        composition = FaceComposition.get_or_none(
            FaceComposition.user == current_user.id, FaceComposition.template == template_id
        )

        if composition:
            # 既存の場合は更新
            composition.adjustments = json.dumps(state)
            composition.save()
        else:
            # 新規作成
            composition = FaceComposition.create(
                user_id=current_user.id, template_id=template_id, adjustments=json.dumps(state)
            )

        return jsonify({"ok": True, "composition_id": composition.id}), 200

    except FaceTemplate.DoesNotExist:
        return jsonify({"ok": False, "error": "template_not_found"}), 404
    except Exception as e:
        current_app.logger.exception(f"adjustments保存エラー: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@client.route("/api/face-template/adjustments/", methods=["GET"])
@client_required
def api_load_adjustments():
    """
    微調整の状態を復元
    """
    import json

    template_id = request.args.get("template_id")

    if not template_id:
        return jsonify({"ok": False, "error": "template_id required"}), 400

    try:
        from models import FaceComposition

        composition = FaceComposition.get_or_none(
            FaceComposition.user == current_user.id, FaceComposition.template == int(template_id)
        )

        if composition and composition.adjustments:
            state = json.loads(composition.adjustments)
            return jsonify({"ok": True, "state": state}), 200
        else:
            return jsonify({"ok": False, "error": "not_found"}), 404

    except Exception as e:
        current_app.logger.exception(f"adjustments復元エラー: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@client.route("/share/face/<export_id>")
def face_template_share(export_id):
    """
    共有URL表示（Step4-B: 画像表示HTML・最短実装）
    """
    from flask import render_template_string
    import json
    import os

    export_dir = current_app.config["FIRSTLOOK_EXPORT_DIR"]
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
    can_retry = current_user.is_authenticated and meta.get("user_id") == current_user.id

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
        debug=debug,
    )


@client.route("/share/face/<export_id>/image")
def face_export_image(export_id):
    """
    Export画像を配信（後方互換用）
    """
    from flask import current_app, send_file
    import os

    export_dir = current_app.config["FIRSTLOOK_EXPORT_DIR"]
    png_path = os.path.join(export_dir, f"{export_id}.png")

    if not os.path.exists(png_path):
        return "Image Not Found", 404

    return send_file(png_path, mimetype="image/png")


# ========================================
# Step4-B: Export画像配信（最短実装）
# ========================================


@client.route("/exports/<path:filename>")
def serve_exports(filename):
    """
    Export画像の静的配信

    ディレクトリトラバーサル対策を含む
    """
    # セキュリティチェック
    if ".." in filename or filename.startswith("/"):
        abort(400)

    export_dir = current_app.config["FIRSTLOOK_EXPORT_DIR"]
    return send_from_directory(export_dir, filename)


# ========================================
# Step4-B: 再生成エンドポイント
# ========================================


@client.route("/api/face-template/retry-render/<export_id>", methods=["POST"])
@client_required
def api_retry_render(export_id):
    """
    PNG再生成エンドポイント
    JSONを読み直してPNG生成を再試行
    """
    import json
    import os
    from utils.render_engine import render_export

    export_dir = current_app.config["FIRSTLOOK_EXPORT_DIR"]
    meta_path = os.path.join(export_dir, f"{export_id}.json")
    png_path = os.path.join(export_dir, f"{export_id}.png")

    # メタデータ読み込み
    if not os.path.exists(meta_path):
        return jsonify({"ok": False, "error": "meta_not_found"}), 404

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    # 権限チェック（所有者のみ）
    if meta.get("user_id") != current_user.id:
        return jsonify({"ok": False, "error": "permission_denied"}), 403

    # PNG再生成
    try:
        upload_dir = current_app.config["FIRSTLOOK_UPLOAD_DIR"]
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


# ========================================
# Look Records（見た目記録）機能
# ========================================


@client.route("/look-records")
@client_required
def look_records():
    """見た目記録一覧（月別グループ化）"""
    records = (
        LookRecord.select()
        .where(LookRecord.user_id == current_user.id)
        .order_by(LookRecord.date.desc())
        .limit(100)
    )

    # 月別にグループ化
    records_by_month = []
    for month_key, group in groupby(records, key=lambda r: r.date.strftime("%Y-%m")):
        records_list = list(group)
        # 月表示用（例: 2026年2月）
        month_display = datetime.strptime(month_key, "%Y-%m").strftime("%Y年%m月")
        records_by_month.append({"month": month_key, "month_display": month_display, "records": records_list})

    return render_template("client/look_records.html", records_by_month=records_by_month, hide_scores=current_user.hide_scores)


@client.route('/look-records/calendar')
@client_required
def look_records_calendar():
    """月カレンダー表示"""
    
    # ?month=YYYY-MM を取得
    month_str = request.args.get('month')
    
    if month_str:
        year, month = map(int, month_str.split('-'))
        target_date = date(year, month, 1)
    else:
        target_date = date.today().replace(day=1)
    
    year = target_date.year
    month = target_date.month
    
    # 月初・月末
    _, last_day = calendar.monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, last_day)
    
    # 月内の記録取得
    records = (
        LookRecord
        .select()
        .where(
            (LookRecord.user_id == current_user.id) &
            (LookRecord.date.between(month_start, month_end))
        )
    )
    
    # 日付→record 辞書
    record_map = {r.date: r for r in records}
    
    # カレンダー配列生成（週×7）
    cal = calendar.Calendar(firstweekday=6)  # 日曜開始
    month_days = list(cal.monthdatescalendar(year, month))
    
    # 前月・次月リンク用
    prev_month = (month_start - timedelta(days=1)).replace(day=1)
    next_month = (month_end + timedelta(days=1)).replace(day=1)
    
    return render_template(
        'client/look_records_calendar.html',
        month_days=month_days,
        record_map=record_map,
        year=year,
        month=month,
        prev_month=prev_month.strftime('%Y-%m'),
        next_month=next_month.strftime('%Y-%m'),
        today=date.today(),
        hide_scores=current_user.hide_scores
    )


@client.route("/summary/week")
@client_required
def weekly_summary():
    """週間サマリー表示"""
    today = date.today()
    start = today - timedelta(days=6)  # 今日含めて7日

    records = (
        LookRecord.select()
        .where(
            (LookRecord.user_id == current_user.id) & (LookRecord.date.between(start, today))
        )
        .order_by(LookRecord.date.asc())
    )

    recs = list(records)
    count = len(recs)

    if count == 0:
        return render_template(
            "client/weekly_summary.html",
            start=start,
            end=today,
            count=0,
        )

    # 平均（総合スコア）- score_totalがNoneでないもののみ
    valid_scores = [r.score_total for r in recs if r.score_total is not None]
    if not valid_scores:
        return render_template(
            "client/weekly_summary.html",
            start=start,
            end=today,
            count=count,
            avg_total=None,
        )

    avg_total = round(sum(valid_scores) / len(valid_scores))

    # 内訳スコアの平均
    valid_contour = [r.score_contour for r in recs if r.score_contour is not None]
    valid_skin = [r.score_skin for r in recs if r.score_skin is not None]
    valid_young = [r.score_young for r in recs if r.score_young is not None]

    avg_contour = round(sum(valid_contour) / len(valid_contour)) if valid_contour else 50
    avg_skin = round(sum(valid_skin) / len(valid_skin)) if valid_skin else 50
    avg_young = round(sum(valid_young) / len(valid_young)) if valid_young else 50

    # ベスト/ワースト
    best = max(recs, key=lambda r: (r.score_total or 0))
    worst = min(recs, key=lambda r: (r.score_total or 0))

    # 週間の伸び（期間内の最初→最後）
    first = recs[0]
    last = recs[-1]
    week_delta = (last.score_total or 0) - (first.score_total or 0)

    # 簡易コーチコメント（短く・辛口寄りだが失礼にしない）
    comment = build_weekly_comment(avg_total, week_delta, best, worst)

    # 来週のフォーカス
    next_focus = choose_next_focus(avg_contour, avg_skin, avg_young)

    return render_template(
        "client/weekly_summary.html",
        start=start,
        end=today,
        count=count,
        avg_total=avg_total,
        best=best,
        worst=worst,
        week_delta=week_delta,
        comment=comment,
        next_focus=next_focus,
        hide_scores=current_user.hide_scores,
    )


@client.route("/progress")
@client_required
def progress():
    """進化の証明（Day0 vs Today）"""
    # 最初の記録（Day0）
    first_record = (
        LookRecord.select()
        .where((LookRecord.user_id == current_user.id) & (LookRecord.score_total.is_null(False)))
        .order_by(LookRecord.date.asc())
        .first()
    )

    # 最新の記録（Today）
    latest_record = (
        LookRecord.select()
        .where((LookRecord.user_id == current_user.id) & (LookRecord.score_total.is_null(False)))
        .order_by(LookRecord.date.desc())
        .first()
    )

    # レコードが2件未満の場合
    if not first_record or not latest_record or first_record.id == latest_record.id:
        return render_template("client/progress.html", has_data=False)

    # スコア差分を計算
    score_diff = {
        "total": latest_record.score_total - first_record.score_total,
        "contour": latest_record.score_contour - first_record.score_contour,
        "skin": latest_record.score_skin - first_record.score_skin,
        "young": latest_record.score_young - first_record.score_young,
    }

    # 経過日数
    days_elapsed = (latest_record.date - first_record.date).days

    return render_template(
        "client/progress.html",
        has_data=True,
        first_record=first_record,
        latest_record=latest_record,
        score_diff=score_diff,
        days_elapsed=days_elapsed,
        hide_scores=current_user.hide_scores,
    )


@client.route("/progress/card")
@client_required
def progress_card():
    """進化カード画像を生成して返却"""
    # 最初の記録（Day0）
    first_record = (
        LookRecord.select()
        .where((LookRecord.user_id == current_user.id) & (LookRecord.score_total.is_null(False)))
        .order_by(LookRecord.date.asc())
        .first()
    )

    # 最新の記録（Today）
    latest_record = (
        LookRecord.select()
        .where((LookRecord.user_id == current_user.id) & (LookRecord.score_total.is_null(False)))
        .order_by(LookRecord.date.desc())
        .first()
    )

    # レコードが2件未満の場合
    if not first_record or not latest_record or first_record.id == latest_record.id:
        return jsonify({"ok": False, "error": "insufficient_records"}), 400

    # 出力先パス
    export_dir = current_app.config.get("FIRSTLOOK_EXPORT_DIR", "instance/exports")
    card_dir = os.path.join(export_dir, "progress_cards", str(current_user.id))
    output_path = os.path.join(card_dir, "latest.png")

    # 絶対パスに変換（相対パスの場合）
    if not os.path.isabs(first_record.photo_path):
        upload_dir = current_app.config.get("FIRSTLOOK_UPLOAD_DIR", "instance/uploads")
        first_record.photo_path = os.path.join(upload_dir, first_record.photo_path)

    if not os.path.isabs(latest_record.photo_path):
        upload_dir = current_app.config.get("FIRSTLOOK_UPLOAD_DIR", "instance/uploads")
        latest_record.photo_path = os.path.join(upload_dir, latest_record.photo_path)

    # 進化カード生成
    success = generate_progress_card(first_record, latest_record, output_path)

    if not success:
        return jsonify({"ok": False, "error": "generation_failed"}), 500

    # イベントログ記録（Phase E2）
    from utils.event_logger import log_event, EVENT_GENERATED_PROGRESS_CARD
    log_event(current_user, EVENT_GENERATED_PROGRESS_CARD)

    # 画像ファイルを返却
    try:
        return send_from_directory(
            os.path.dirname(output_path),
            os.path.basename(output_path),
            mimetype="image/png",
            as_attachment=True,
            download_name=f"progress_card_{current_user.id}.png",
        )
    except Exception as e:
        current_app.logger.exception("progress_card download failed")
        return jsonify({"ok": False, "error": str(e)}), 500


@client.route("/api/look-records/save", methods=["POST"])
@client_required
def save_look_record():
    """見た目記録を保存（After画像 + Future Face設定）"""
    try:
        data = request.get_json()
        current_app.logger.info(f"[save_look_record] リクエスト受信: user={current_user.id}")

        if not data:
            current_app.logger.warning("[save_look_record] データなし")
            return jsonify({"ok": False, "error": "invalid_request"}), 400

        image_base64 = data.get("image_base64")
        preset = data.get("preset", "all")
        strength = data.get("strength", 40)
        record_date = data.get("date")

        # ========================================
        # バリデーション
        # ========================================

        # 画像必須チェック
        if not image_base64:
            current_app.logger.warning("[save_look_record] 画像データなし")
            return jsonify({"ok": False, "error": "image_required"}), 400

        # dataURL形式チェック（PNG のみ）
        if not image_base64.startswith("data:image/png;base64,"):
            current_app.logger.warning(f"[save_look_record] 無効な画像形式: {image_base64[:50]}...")
            return jsonify({"ok": False, "error": "invalid_image_format_png_only"}), 400

        # プリセット検証
        valid_presets = ["all", "slim", "skin", "young"]
        if preset not in valid_presets:
            return jsonify({"ok": False, "error": f"invalid_preset_must_be_{'/'.join(valid_presets)}"}), 400

        # 強度検証（0-100）
        try:
            strength = int(strength)
            if not 0 <= strength <= 100:
                return jsonify({"ok": False, "error": "invalid_strength_must_be_0_100"}), 400
        except (ValueError, TypeError):
            return jsonify({"ok": False, "error": "invalid_strength_not_integer"}), 400

        # 日付解析（省略時は今日）
        if record_date:
            try:
                record_date = datetime.strptime(record_date, "%Y-%m-%d").date()
            except ValueError:
                return jsonify({"ok": False, "error": "invalid_date_format"}), 400
        else:
            record_date = date.today()

        # Base64デコード
        image_base64 = image_base64.split(",")[1]

        try:
            image_bytes = base64.b64decode(image_base64)
        except Exception as e:
            return jsonify({"ok": False, "error": f"base64_decode_failed: {str(e)}"}), 400

        # サイズ制限（5MB）
        MAX_SIZE_MB = 5
        if len(image_bytes) > MAX_SIZE_MB * 1024 * 1024:
            return jsonify({"ok": False, "error": f"image_too_large_max_{MAX_SIZE_MB}MB"}), 400

        # ========================================
        # 画像処理（Pillowでリサイズ）
        # ========================================

        try:
            # バイト列から画像読み込み
            img = Image.open(io.BytesIO(image_bytes))

            # RGBA → RGB 変換（PNG透過対応）
            if img.mode == "RGBA":
                # 白背景で合成
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])  # アルファチャンネルをマスクに
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")

            # 最大辺1080pxにリサイズ（アスペクト比維持）
            MAX_SIZE = 1080
            if max(img.size) > MAX_SIZE:
                img.thumbnail((MAX_SIZE, MAX_SIZE), Image.Resampling.LANCZOS)
                current_app.logger.info(f"画像リサイズ実行: {img.size}")

            # BytesIOに再エンコード
            output = io.BytesIO()
            img.save(output, format="PNG", optimize=True, quality=85)
            processed_image_bytes = output.getvalue()

        except Exception as e:
            return jsonify({"ok": False, "error": f"image_processing_failed: {str(e)}"}), 400

        # ========================================
        # 保存処理
        # ========================================

        # 保存先ディレクトリ作成
        # /data/records/<user_id>/<YYYY-MM>/
        records_base_dir = os.path.join(
            current_app.config.get("FIRSTLOOK_UPLOAD_DIR", "instance/uploads"), "look_records"
        )
        user_dir = os.path.join(records_base_dir, str(current_user.id))
        month_dir = os.path.join(user_dir, record_date.strftime("%Y-%m"))
        os.makedirs(month_dir, exist_ok=True)

        # ファイル名: YYYY-MM-DD.png
        filename = f"{record_date.strftime('%Y-%m-%d')}.png"
        file_path = os.path.join(month_dir, filename)

        # PNG保存（リサイズ済み画像）
        with open(file_path, "wb") as f:
            f.write(processed_image_bytes)

        # DB保存パスは相対パス
        relative_path = f"look_records/{current_user.id}/{record_date.strftime('%Y-%m')}/{filename}"

        # Upsert（同日なら上書き）
        record, created = LookRecord.get_or_create(
            user_id=current_user.id,
            date=record_date,
            defaults={"photo_path": relative_path, "preset": preset, "strength": strength},
        )

        if not created:
            # 既存レコードを更新
            record.photo_path = relative_path
            record.preset = preset
            record.strength = strength
            record.created_at = datetime.now()
            record.save()

        # ========================================
        # AIコーチ判定（スコア算出）- Phase B
        # ========================================

        try:
            # 保存した画像からスコア算出
            scores = compute_look_scores(file_path)

            # 前回レコード取得（今日以外の直近）
            previous_record = (
                LookRecord.select()
                .where(
                    (LookRecord.user_id == current_user.id)
                    & (LookRecord.date < record_date)
                    & (LookRecord.score_total.is_null(False))
                )
                .order_by(LookRecord.date.desc())
                .first()
            )

            # 前回比算出
            score_diff = None
            if previous_record and previous_record.score_total is not None:
                score_diff = scores["total"] - previous_record.score_total

            # スコア保存
            record.score_total = scores["total"]
            record.score_contour = scores["contour"]
            record.score_skin = scores["skin"]
            record.score_young = scores["young"]
            record.score_diff = score_diff
            record.save()

            current_app.logger.info(
                f"Look record scores: user={current_user.id}, date={record_date}, "
                f"total={scores['total']}, diff={score_diff}, "
                f"contour={scores['contour']}, skin={scores['skin']}, young={scores['young']}"
            )

        except Exception as e:
            # スコア算出失敗してもレコード保存は成功扱い
            current_app.logger.error(f"Score computation failed: {e}")

        # ========================================
        # Freeze補充（Phase D2）
        # ========================================
        from utils.look_streak import refill_freeze, calculate_current_streak_with_freeze

        current_streak = calculate_current_streak_with_freeze(current_user)
        refill_freeze(current_user, current_streak)

        # ========================================
        # 達成バッジ判定（Phase D4）
        # ========================================
        from utils.achievement import check_streak_achievements

        new_achievement = check_streak_achievements(current_user, current_streak)

        # ========================================
        # イベントログ記録（Phase E2 + Focus Mode計測）
        # ========================================
        from utils.event_logger import log_event, EVENT_SAVED_RECORD

        log_event(current_user, EVENT_SAVED_RECORD)
        log_event(current_user, "look_record_saved")  # Focus Mode計測用

        current_app.logger.info(
            f"Look record saved: user={current_user.id}, date={record_date}, preset={preset}, strength={strength}, is_updated={not created}"
        )

        return (
            jsonify(
                {
                    "ok": True,
                    "record_id": record.id,
                    "date": record_date.strftime("%Y-%m-%d"),
                    "is_updated": not created,  # 上書き保存フラグ
                    "scores": {
                        "total": record.score_total,
                        "contour": record.score_contour,
                        "skin": record.score_skin,
                        "young": record.score_young,
                        "diff": record.score_diff,
                    },
                    "new_achievement": new_achievement,  # 新規獲得バッジ（Phase D4）
                }
            ),
            200,
        )

    except Exception as e:
        current_app.logger.exception("save_look_record failed")
        return jsonify({"ok": False, "error": str(e)}), 500


@client.route("/api/event", methods=["POST"])
@login_required
@client_required
def log_client_event():
    """
    クライアント側イベントログ記録API（Focus Mode計測用）
    
    POST /client/api/event
    Body: {"event": "dashboard_capture_clicked"}
    """
    try:
        data = request.get_json()
        if not data or "event" not in data:
            return jsonify({"ok": False, "error": "event_required"}), 400
        
        event_name = data["event"]
        
        # allowlist（セキュリティ）
        ALLOWED_EVENTS = [
            "dashboard_capture_clicked",
            "dashboard_tools_override_clicked",
        ]
        
        if event_name not in ALLOWED_EVENTS:
            return jsonify({"ok": False, "error": "invalid_event"}), 400
        
        # イベント記録
        from utils.event_logger import log_event
        log_event(current_user, event_name)
        
        return jsonify({"ok": True}), 200
    
    except Exception as e:
        current_app.logger.error(f"log_client_event failed: {e}")
        return jsonify({"ok": False, "error": "internal_error"}), 500


# ========================================
# Daily Loop（今日の一歩）機能
# ========================================


def calculate_streak(user_id: int) -> int:
    """
    連続達成日数を計算

    Args:
        user_id: ユーザーID

    Returns:
        連続達成日数
    """
    today = date.today()
    streak = 0

    # 今日から遡って連続completedを数える
    current_date = today

    while True:
        action = (
            DailyAction.select()
            .where((DailyAction.user_id == user_id) & (DailyAction.date == current_date))
            .first()
        )

        if not action or not action.completed:
            break

        streak += 1
        current_date -= timedelta(days=1)

        # 安全装置（無限ループ防止）
        if streak > 365:
            break

    return streak


@client.route("/daily-action")
@client_required
def daily_action():
    """今日の一歩を取得"""
    today = date.today()

    # 今日のアクション取得
    action = (
        DailyAction.select()
        .where((DailyAction.user_id == current_user.id) & (DailyAction.date == today))
        .first()
    )

    # 今日のアクションが無ければランダム生成
    if not action:
        random_action = get_random_action()
        action = DailyAction.create(
            user_id=current_user.id, date=today, action_key=random_action["key"], completed=False
        )
        current_app.logger.info(
            f"Daily action created: user={current_user.id}, action={random_action['key']}"
        )

    # アクション詳細取得
    action_detail = get_action_by_key(action.action_key)

    # ストリーク計算
    streak = calculate_streak(current_user.id)

    return render_template(
        "client/daily_action.html", action=action, action_detail=action_detail, streak=streak
    )


@client.route("/api/daily-action/complete", methods=["POST"])
@client_required
def complete_daily_action():
    """今日の一歩を完了（API）"""
    today = date.today()

    try:
        # 今日のアクション取得
        action = (
            DailyAction.select()
            .where((DailyAction.user_id == current_user.id) & (DailyAction.date == today))
            .first()
        )

        if not action:
            return jsonify({"ok": False, "error": "today_action_not_found"}), 404

        # 既に完了済みならエラー
        if action.completed:
            return jsonify({"ok": False, "error": "already_completed"}), 400

        # 完了フラグを立てる
        action.completed = True
        action.save()

        # ストリーク再計算
        streak = calculate_streak(current_user.id)

        # イベントログ記録
        try:
            from utils.event_logger import log_event, EVENT_COMPLETED_DAILY_ACTION
            log_event(current_user, EVENT_COMPLETED_DAILY_ACTION)
        except:
            pass  # サイレントエラー

        current_app.logger.info(
            f"Daily action completed: user={current_user.id}, action={action.action_key}, streak={streak}"
        )

        return jsonify({"ok": True, "action_key": action.action_key, "streak": streak}), 200

    except Exception as e:
        current_app.logger.exception("complete_daily_action failed")
        return jsonify({"ok": False, "error": str(e)}), 500


# ========================================
# Referral（招待）機能
# ========================================


@client.route("/referral")
@client_required
def referral():
    """招待画面"""
    from utils.referral import get_referral_stats, generate_referral_code

    # 既存ユーザーにreferral_codeがない場合は生成
    if not current_user.referral_code:
        current_user.referral_code = generate_referral_code()
        current_user.save()

    stats = get_referral_stats(current_user)
    
    # 招待URL生成
    referral_url = url_for('auth.register', _external=True) + f"?ref={current_user.referral_code}"

    return render_template(
        "client/referral.html",
        referral_code=current_user.referral_code,
        referral_url=referral_url,
        referred_count=stats['referred_count'],
    )


@client.route("/api/referral/track-copy", methods=["POST"])
@client_required
def track_referral_copy():
    """招待コピーイベントを記録"""
    from utils.event_logger import log_event, EVENT_SENT_REFERRAL
    
    log_event(current_user, EVENT_SENT_REFERRAL)
    
    return jsonify({"ok": True}), 200


# ========================================
# Settings（設定）機能
# ========================================


@client.route("/settings", methods=["GET", "POST"])
@client_required
def settings():
    """設定画面"""
    if request.method == "POST":
        try:
            # スコア非表示設定
            hide_scores = 1 if request.form.get("hide_scores") else 0
            current_user.hide_scores = hide_scores
            current_user.save()
            
            flash("設定を保存しました", "success")
            return redirect(url_for("client.settings"))
        except Exception as e:
            flash(f"保存中にエラーが発生しました: {str(e)}", "danger")
    
    return render_template("client/settings.html")

