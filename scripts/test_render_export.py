#!/usr/bin/env python3
"""
render_export() 単体テスト
Flask起動なしでPNG生成を確認
"""
import os
import sys
import json

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from utils.render_engine import render_export


def test_render_export():
    """render_export関数の単体テスト"""
    
    # プロジェクトルート
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    # アップロードディレクトリ
    upload_dir = os.path.join(project_root, 'uploads')
    
    # 出力先
    output_dir = os.path.join(project_root, 'test_output')
    os.makedirs(output_dir, exist_ok=True)
    
    output_png_path = os.path.join(output_dir, 'test_export.png')
    
    # テストメタデータ（実際のファイルパスに置き換えてください）
    meta = {
        "template_id": 1,
        "base_image_path": "face_templates/user_1/template_1.jpg",  # 実際のパスに変更
        "parts": {
            "leftBrow": {
                "path": "face_parts/eyebrows/eyebrow_1.png"  # 実際のパスに変更
            },
            "rightBrow": {
                "path": "face_parts/eyebrows/eyebrow_1.png"  # 実際のパスに変更
            },
            "nose": {
                "path": "face_parts/noses/nose_1.png"  # 実際のパスに変更
            }
        },
        "anchors": {
            "leftBrow": {"x": 150, "y": 120, "w": 80, "h": 30},
            "rightBrow": {"x": 250, "y": 120, "w": 80, "h": 30},
            "nose": {"x": 200, "y": 200, "w": 60, "h": 80}
        },
        "state": {
            "eyebrow": {
                "left": {"dx": 0, "dy": 0, "scale": 1.0, "rotate": 0, "opacity": 1.0},
                "right": {"dx": 0, "dy": 0, "scale": 1.0, "rotate": 0, "opacity": 1.0}
            },
            "nose": {"dx": 0, "dy": 5, "scale": 1.1, "rotate": 0, "opacity": 1.0}
        }
    }
    
    print('=== render_export() 単体テスト ===')
    print(f'Upload dir: {upload_dir}')
    print(f'Output: {output_png_path}')
    print(f'Meta: {json.dumps(meta, indent=2, ensure_ascii=False)}')
    print()
    
    try:
        render_export(meta, output_png_path, upload_dir)
        print('✅ PNG生成成功')
        print(f'   出力先: {output_png_path}')
        
        # ファイル存在確認
        if os.path.exists(output_png_path):
            file_size = os.path.getsize(output_png_path)
            print(f'   ファイルサイズ: {file_size / 1024:.1f} KB')
        else:
            print('❌ 出力ファイルが見つかりません')
            
    except Exception as e:
        print(f'❌ PNG生成失敗: {e}')
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    test_render_export()
