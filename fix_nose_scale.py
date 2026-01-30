"""
鼻タイプ3のスケールを調整するスクリプト

実行方法:
    python fix_nose_scale.py
"""
from models.face_template import FacePart

def fix_nose_scales():
    """鼻パーツのスケールを調整"""
    print('鼻パーツのスケール調整中...\n')
    
    # 鼻タイプ3のスケールを0.8に変更
    nose_3 = FacePart.get_or_none(
        FacePart.part_type == 'nose',
        FacePart.label == '鼻タイプ3'
    )
    
    if nose_3:
        old_scale = nose_3.scale
        nose_3.scale = 0.8
        nose_3.save()
        print(f'✓ 鼻タイプ3: scale {old_scale} → 0.8')
    else:
        print('⚠️  鼻タイプ3が見つかりません')
    
    # 全ての鼻パーツのスケールを確認
    print('\n現在の鼻パーツスケール一覧:')
    noses = FacePart.select().where(FacePart.part_type == 'nose').order_by(FacePart.id)
    
    for nose in noses:
        print(f'  {nose.label}: scale={nose.scale}')
    
    print('\n完了！ブラウザをリロードして確認してください。')

if __name__ == '__main__':
    fix_nose_scales()
