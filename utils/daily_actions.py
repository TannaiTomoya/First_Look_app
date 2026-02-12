"""
Daily Action（今日の一歩）アクションプール
シンプルなグルーミング・自己ケアタスク
"""
import random


# アクションプール（20種類）
ACTION_POOL = {
    # スキンケア（7種類）
    'face_wash': {
        'key': 'face_wash',
        'title': '洗顔を丁寧にする',
        'description': '朝晩の洗顔を1分かけて丁寧に行いましょう',
        'icon': 'fa-soap'
    },
    'moisturize': {
        'key': 'moisturize',
        'title': '洗顔後に保湿をする',
        'description': '洗顔後5分以内に化粧水と乳液で保湿しましょう',
        'icon': 'fa-droplet'
    },
    'sunscreen': {
        'key': 'sunscreen',
        'title': '日焼け止めを塗る',
        'description': '外出30分前に日焼け止めを塗りましょう（曇りでも）',
        'icon': 'fa-sun'
    },
    'eyebrow_check': {
        'key': 'eyebrow_check',
        'title': '眉を整える',
        'description': '鏡で眉の形をチェックし、余分な毛を処理',
        'icon': 'fa-eye'
    },
    'shaving': {
        'key': 'shaving',
        'title': 'ヒゲを丁寧に剃る',
        'description': 'シェービングクリームを使って丁寧に剃りましょう',
        'icon': 'fa-scissors'
    },
    'facial_massage': {
        'key': 'facial_massage',
        'title': '顔のマッサージをする',
        'description': '血行促進のために3分間、顔を優しくマッサージ',
        'icon': 'fa-hand-sparkles'
    },
    'lip_care': {
        'key': 'lip_care',
        'title': 'リップクリームを塗る',
        'description': '唇の乾燥を防ぐため、1日3回リップクリームを塗る',
        'icon': 'fa-lips'
    },
    
    # 健康・生活習慣（7種類）
    'water': {
        'key': 'water',
        'title': '水を1.5L飲む',
        'description': '肌の水分補給のために1日1.5Lの水を飲みましょう',
        'icon': 'fa-glass-water'
    },
    'sleep': {
        'key': 'sleep',
        'title': '7時間睡眠をとる',
        'description': '肌の再生のために7時間以上の睡眠を確保',
        'icon': 'fa-bed'
    },
    'posture': {
        'key': 'posture',
        'title': '姿勢を意識する',
        'description': '背筋を伸ばし、顎を引いた姿勢を1時間キープ',
        'icon': 'fa-person-walking'
    },
    'no_alcohol': {
        'key': 'no_alcohol',
        'title': 'アルコールを控える',
        'description': '今日は飲酒を控えて、肌の回復を促進',
        'icon': 'fa-ban'
    },
    'balanced_meal': {
        'key': 'balanced_meal',
        'title': '野菜を多めに食べる',
        'description': 'ビタミン摂取のため、野菜を1食あたり120g以上',
        'icon': 'fa-leaf'
    },
    'screen_time': {
        'key': 'screen_time',
        'title': '画面を見る時間を減らす',
        'description': '目の疲れを防ぐため、1時間に10分休憩',
        'icon': 'fa-mobile-screen'
    },
    'fresh_air': {
        'key': 'fresh_air',
        'title': '外の空気を吸う',
        'description': '15分間の散歩で気分転換とビタミンD生成',
        'icon': 'fa-wind'
    },
    
    # 運動（6種類）
    'workout': {
        'key': 'workout',
        'title': '軽い運動をする',
        'description': '10分間のストレッチや軽い運動で血行促進',
        'icon': 'fa-dumbbell'
    },
    'facial_relax': {
        'key': 'facial_relax',
        'title': '顔の力を抜く',
        'description': '無意識に力が入っていないか確認し、リラックス',
        'icon': 'fa-face-smile'
    },
    'neck_stretch': {
        'key': 'neck_stretch',
        'title': '首のストレッチ',
        'description': '首をゆっくり回して、コリをほぐす（左右各5回）',
        'icon': 'fa-head-side-virus'
    },
    'breathing': {
        'key': 'breathing',
        'title': '深呼吸をする',
        'description': '5分間の深呼吸でストレス軽減と血行促進',
        'icon': 'fa-lungs'
    },
    'cardio': {
        'key': 'cardio',
        'title': '有酸素運動をする',
        'description': '軽いジョギングやウォーキングを20分間',
        'icon': 'fa-person-running'
    },
    'face_yoga': {
        'key': 'face_yoga',
        'title': '表情筋トレーニング',
        'description': '「あいうえお」を大きく動かして表情筋を鍛える',
        'icon': 'fa-face-grin-wide'
    }
}


def get_random_action() -> dict:
    """
    ランダムにアクションを1つ取得

    Returns:
        アクション辞書
    """
    action_key = random.choice(list(ACTION_POOL.keys()))
    return ACTION_POOL[action_key]


def get_action_by_key(action_key: str) -> dict:
    """
    キーでアクションを取得

    Args:
        action_key: アクションキー

    Returns:
        アクション辞書（存在しない場合はデフォルト）
    """
    return ACTION_POOL.get(action_key, {
        'key': action_key,
        'title': 'アクション',
        'description': '',
        'icon': 'fa-check'
    })
