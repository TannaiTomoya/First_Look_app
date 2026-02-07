#!/usr/bin/env python
"""
顔パーツ画像セットアップスクリプト

使用方法:
1. 眉と鼻の画像をこのスクリプトと同じディレクトリに配置:
   - brow_natural.png
   - brow_soft_1.png
   - brow_soft_2.png
   - brow_strong.png
   - nose_straight.png
   - nose_soft_round.png
   - nose_high_bridge.png

2. スクリプトを実行:
   python setup_face_parts.py
"""
import os
import shutil

# 配置先ディレクトリ
EYEBROW_DIR = "static/images/face_parts/eyebrows"
NOSE_DIR = "static/images/face_parts/noses"

# 画像ファイルのマッピング
EYEBROW_FILES = [
    "brow_natural.png",
    "brow_soft_1.png",
    "brow_soft_2.png",
    "brow_strong.png",
]

NOSE_FILES = [
    "nose_straight.png",
    "nose_soft_round.png",
    "nose_high_bridge.png",
]

def setup():
    """画像ファイルを配置"""
    print("顔パーツ画像のセットアップを開始します...\n")
    
    # ディレクトリ作成
    os.makedirs(EYEBROW_DIR, exist_ok=True)
    os.makedirs(NOSE_DIR, exist_ok=True)
    print(f"✓ ディレクトリを作成しました")
    print(f"  - {EYEBROW_DIR}")
    print(f"  - {NOSE_DIR}\n")
    
    # 眉画像をコピー
    print("眉画像をコピー中...")
    copied_eyebrows = 0
    for filename in EYEBROW_FILES:
        if os.path.exists(filename):
            dest = os.path.join(EYEBROW_DIR, filename)
            shutil.copy2(filename, dest)
            print(f"  ✓ {filename} → {dest}")
            copied_eyebrows += 1
        else:
            print(f"  ⚠ {filename} が見つかりません")
    
    # 鼻画像をコピー
    print("\n鼻画像をコピー中...")
    copied_noses = 0
    for filename in NOSE_FILES:
        if os.path.exists(filename):
            dest = os.path.join(NOSE_DIR, filename)
            shutil.copy2(filename, dest)
            print(f"  ✓ {filename} → {dest}")
            copied_noses += 1
        else:
            print(f"  ⚠ {filename} が見つかりません")
    
    # 結果表示
    print("\n" + "=" * 50)
    print(f"セットアップ完了: 眉 {copied_eyebrows}/{len(EYEBROW_FILES)}, 鼻 {copied_noses}/{len(NOSE_FILES)}")
    print("=" * 50)
    
    if copied_eyebrows < len(EYEBROW_FILES) or copied_noses < len(NOSE_FILES):
        print("\n⚠ 一部の画像ファイルが見つかりませんでした。")
        print("このスクリプトと同じディレクトリに画像を配置してから再実行してください。")
        return False
    
    print("\n次のステップ:")
    print("  python db_manager.py seed")
    print("を実行して、データベースにパーツ情報を登録してください。")
    return True

if __name__ == "__main__":
    setup()
