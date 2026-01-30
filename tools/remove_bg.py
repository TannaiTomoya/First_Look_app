"""
顔パーツ画像の背景を一括透明化

実行方法:
    python tools/remove_bg.py

処理内容:
    - 眉パーツ（static/images/face_parts/eyebrows/*.png）
    - 鼻パーツ（static/images/face_parts/noses/*.png）
    の背景をAIで自動除去し、透明化します。
"""
from rembg import remove
from PIL import Image
import os
import sys

def process_directory(input_dir):
    """ディレクトリ内の全PNG画像を透明化"""
    if not os.path.exists(input_dir):
        print(f'⚠️  ディレクトリが見つかりません: {input_dir}')
        return 0
    
    processed = 0
    errors = 0
    
    files = [f for f in os.listdir(input_dir) if f.endswith('.png')]
    
    if not files:
        print(f'⚠️  PNG画像が見つかりません')
        return 0
    
    for filename in files:
        file_path = os.path.join(input_dir, filename)
        
        try:
            print(f'  処理中: {filename}...', end=' ', flush=True)
            
            # 画像読み込み
            with open(file_path, 'rb') as f:
                input_data = f.read()
            
            # 背景除去（AI処理）
            output_data = remove(input_data)
            
            # 上書き保存
            with open(file_path, 'wb') as f:
                f.write(output_data)
            
            print('✓ 完了')
            processed += 1
            
        except Exception as e:
            print(f'✗ エラー: {str(e)}')
            errors += 1
    
    return processed, errors

# メイン処理
if __name__ == '__main__':
    print('=' * 50)
    print('  顔パーツ背景透明化ツール')
    print('=' * 50)
    print()
    
    total_processed = 0
    total_errors = 0
    
    # 眉パーツ処理
    print('[1/2] 眉パーツ処理中...')
    eyebrow_dir = 'static/images/face_parts/eyebrows'
    count1, err1 = process_directory(eyebrow_dir)
    print(f'✓ {count1}件処理完了', end='')
    if err1 > 0:
        print(f' ({err1}件エラー)', end='')
    print('\n')
    total_processed += count1
    total_errors += err1
    
    # 鼻パーツ処理
    print('[2/2] 鼻パーツ処理中...')
    nose_dir = 'static/images/face_parts/noses'
    count2, err2 = process_directory(nose_dir)
    print(f'✓ {count2}件処理完了', end='')
    if err2 > 0:
        print(f' ({err2}件エラー)', end='')
    print('\n')
    total_processed += count2
    total_errors += err2
    
    # 結果サマリー
    print('=' * 50)
    print(f'  完了: 合計 {total_processed}件 処理しました')
    if total_errors > 0:
        print(f'  エラー: {total_errors}件')
    print('=' * 50)
    print()
    print('次のステップ:')
    print('  1. ブラウザで画像を確認')
    print('  2. 問題なければJPGファイルを削除（オプション）')
    print('  3. アプリを再起動して効果を確認')
