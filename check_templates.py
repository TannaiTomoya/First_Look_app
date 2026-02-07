"""
FaceTemplateのデータを確認
"""
import sys
import os

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import FaceTemplate

def check_templates():
    """テンプレートデータを確認"""
    print("=== FaceTemplate データ確認 ===\n")
    
    templates = FaceTemplate.select().order_by(FaceTemplate.id.desc()).limit(5)
    
    if not templates:
        print("テンプレートが見つかりません")
        return
    
    for template in templates:
        print(f"ID: {template.id}")
        print(f"User ID: {template.user}")
        print(f"Base Image Path: {template.base_image_path}")
        print(f"Created At: {template.created_at}")
        
        # ファイルの存在確認
        upload_dir = os.environ.get('FIRSTLOOK_UPLOAD_DIR', 'uploads')
        full_path = os.path.join(upload_dir, template.base_image_path)
        exists = os.path.exists(full_path)
        print(f"File Exists: {exists} ({full_path})")
        print("-" * 50)

if __name__ == '__main__':
    check_templates()
