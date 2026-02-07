#!/usr/bin/env python
"""
眉画像を左半分のみに切り出すスクリプト

既存の眉画像（左右セット）から左半分だけを切り出して上書き保存します。
これにより、システムが自動的に左右の位置に配置できるようになります。
"""
import os
from PIL import Image

# 眉画像のパス
EYEBROW_DIR = "static/images/face_parts/eyebrows"
EYEBROW_FILES = ["eyebrow_1.png", "eyebrow_2.png", "eyebrow_3.png", "eyebrow_4.png"]

def crop_eyebrow_to_left(image_path):
    """
    眉画像を左半分のみに切り出す
    
    Args:
        image_path: 画像ファイルのパス
    """
    # 元画像を開く
    img = Image.open(image_path)
    width, height = img.size
    
    print(f"  元画像サイズ: {width}x{height}")
    
    # 左半分を切り出し（x: 0 〜 width//2）
    left_half = img.crop((0, 0, width // 2, height))
    
    # 透明部分を考慮してトリミング（余白を削除）
    if img.mode == 'RGBA':
        # アルファチャンネルを使って実際のコンテンツ領域を取得
        bbox = left_half.getbbox()
        if bbox:
            left_half = left_half.crop(bbox)
            print(f"  トリミング後: {left_half.width}x{left_half.height}")
    
    # バックアップを作成
    backup_path = image_path.replace('.png', '_backup.png')
    if not os.path.exists(backup_path):
        img.save(backup_path)
        print(f"  バックアップ保存: {os.path.basename(backup_path)}")
    
    # 上書き保存
    left_half.save(image_path)
    print(f"  ✓ 左眉のみに加工完了: {os.path.basename(image_path)}")
    
    return left_half.width, left_half.height

def main():
    """メイン処理"""
    print("=" * 60)
    print("眉画像の左半分切り出し処理を開始します")
    print("=" * 60)
    
    if not os.path.exists(EYEBROW_DIR):
        print(f"エラー: ディレクトリが見つかりません: {EYEBROW_DIR}")
        return
    
    processed = 0
    for filename in EYEBROW_FILES:
        filepath = os.path.join(EYEBROW_DIR, filename)
        
        if not os.path.exists(filepath):
            print(f"\n⚠ スキップ: {filename} が見つかりません")
            continue
        
        print(f"\n処理中: {filename}")
        try:
            crop_eyebrow_to_left(filepath)
            processed += 1
        except Exception as e:
            print(f"  ✗ エラー: {e}")
    
    print("\n" + "=" * 60)
    print(f"処理完了: {processed}/{len(EYEBROW_FILES)} 件の画像を加工しました")
    print("=" * 60)
    
    if processed > 0:
        print("\n次のステップ:")
        print("  ブラウザをリロードして、眉の表示を確認してください")
        print("  元の画像は *_backup.png として保存されています")

if __name__ == "__main__":
    main()
