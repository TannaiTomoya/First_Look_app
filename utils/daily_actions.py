"""
Daily Action（今日の一歩）アクションプール
シンプルなグルーミング・自己ケアタスク
"""
import random


# アクションプール（固定10個）
ACTION_POOL = {
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
    'posture': {
        'key': 'posture',
        'title': '姿勢を意識する',
        'description': '背筋を伸ばし、顎を引いた姿勢を1時間キープ',
        'icon': 'fa-person-walking'
    },
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
