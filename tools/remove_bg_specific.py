"""
特定の眉パーツ画像の背景を透明化

実行方法:
    python tools/remove_bg_specific.py

処理内容:
    - 眉タイプ1, 2, 3, 5のみを処理（眉タイプ4は除外）
    - AIで背景を自動除去し、透明化します
"""
from rembg import remove
from PIL import Image
import os
import sys

def process_specific_files(input_dir, filenames):
    """特定のファイルだけを透明化"""
    if not os.path.exists(input_dir):
        print(f'⚠️  ディレクトリが見つかりません: {input_dir}')
        return 0, 0
    
    processed = 0
    errors = 0
    
    for filename in filenames:
        file_path = os.path.join(input_dir, filename)
        
        if not os.path.exists(file_path):
            print(f'⚠️  ファイルが見つかりません: {filename}')
            errors += 1
            continue
        
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
    print('=' * 60)
    print('  特定眉パーツの背景透明化ツール')
    print('=' * 60)
    print()
    
    # 処理対象ファイル（眉タイプ1, 2, 3, 5のみ）
    target_files = [
        'eyebrow_1.png',
        'eyebrow_2.png',
        'eyebrow_3.png',
        'eyebrow_5.png'
    ]
    
    eyebrow_dir = 'static/images/face_parts/eyebrows'
    
    print('📋 処理対象ファイル:')
    for i, f in enumerate(target_files, 1):
        print(f'  {i}. {f}')
    print()
    print('⚠️  注意: 元の画像は上書きされます')
    print('   （必要に応じて事前にバックアップを取ってください）')
    print()
    
    # 確認プロンプト
    response = input('処理を開始しますか？ (y/N): ')
    if response.lower() != 'y':
        print('キャンセルしました。')
        sys.exit(0)
    
    print()
    print('処理開始...')
    print('-' * 60)
    
    count, errors = process_specific_files(eyebrow_dir, target_files)
    
    print('-' * 60)
    print()
    print('=' * 60)
    print(f'  ✅ 完了: {count}件 処理しました')
    if errors > 0:
        print(f'  ⚠️  エラー: {errors}件')
    print('=' * 60)
    print()
    print('📝 次のステップ:')
    print('  1. ブラウザで画像を確認')
    print('     http://127.0.0.1:8000/client/face-template/preview/[ID]')
    print('  2. 問題なければ完了！')
    print('  3. 問題があればバックアップから復元')
    print()
