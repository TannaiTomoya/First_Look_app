#!/usr/bin/env python3
"""
既存のエクスポートPNGを再生成するスクリプト
"""
import os
import sys
import json
from utils.render_engine import render_export
from config import Config

# 設定読み込み
config = Config()
export_dir = config.FIRSTLOOK_EXPORT_DIR
upload_dir = config.FIRSTLOOK_UPLOAD_DIR

def rerender(export_id):
    """指定されたexport_idの画像を再生成"""
    meta_path = os.path.join(export_dir, f"{export_id}.json")
    png_path = os.path.join(export_dir, f"{export_id}.png")
    
    if not os.path.exists(meta_path):
        print(f"❌ メタデータが見つかりません: {meta_path}")
        return False
    
    print(f"📄 メタデータ読み込み: {meta_path}")
    with open(meta_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)
    
    print(f"📊 メタ情報:")
    print(f"  - template_id: {meta.get('template_id')}")
    print(f"  - base_image_path: {meta.get('base_image_path')}")
    print(f"  - parts: {list(meta.get('parts', {}).keys())}")
    
    print(f"\n🎨 PNG生成開始...")
    try:
        render_export(meta, png_path, upload_dir)
        print(f"✅ PNG生成成功: {png_path}")
        return True
    except Exception as e:
        print(f"❌ PNG生成失敗: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("使い方: python rerender_export.py <export_id>")
        print("例: python rerender_export.py 2d62a7c0bbfb")
        sys.exit(1)
    
    export_id = sys.argv[1]
    print(f"🔄 エクスポートID: {export_id} を再生成します\n")
    
    success = rerender(export_id)
    sys.exit(0 if success else 1)
