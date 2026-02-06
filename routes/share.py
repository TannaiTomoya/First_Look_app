"""
共有ページルート（Step4）
"""
from flask import Blueprint, render_template, abort, send_from_directory, current_app
from models.render_export import RenderExport
import os

share_bp = Blueprint('share', __name__)


@share_bp.route('/share/<token>')
def view_export(token):
    """共有URL表示（ログイン不要）"""
    # トークンからexportを取得
    export = RenderExport.get_or_none(RenderExport.share_token == token)
    
    if not export:
        abort(404)
    
    # 公開設定チェック（オプション：is_publicをチェックする場合）
    if not export.is_public:
        abort(404)
    
    # 画像URLを生成
    image_url = f'/uploads/{export.output_path}'
    
    # テンプレートを解決
    template_obj = export.template
    if isinstance(template_obj, int):
        from models.face_template import FaceTemplate
        template_obj = FaceTemplate.get_by_id(template_obj)
    
    return render_template(
        'share/export_view.html',
        export=export,
        image_url=image_url,
        template=template_obj
    )


@share_bp.route('/uploads/<path:filename>')
def serve_upload(filename):
    """アップロードファイルを配信"""
    upload_dir = current_app.config['FIRSTLOOK_UPLOAD_DIR']
    return send_from_directory(upload_dir, filename)
