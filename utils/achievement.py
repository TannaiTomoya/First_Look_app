"""
達成バッジ判定ユーティリティ
"""

from models.achievement import Achievement


def check_streak_achievements(user, streak: int):
    """
    ストリークマイルストーン達成をチェック

    Args:
        user: Userオブジェクト
        streak: 現在のストリーク日数

    Returns:
        int or None: 新規獲得したマイルストーン（なければNone）
    """
    milestones = [7, 30, 100]

    for m in milestones:
        if streak >= m:
            key = f"streak_{m}"

            # 既に獲得済みかチェック
            exists = (
                Achievement.select()
                .where((Achievement.user == user) & (Achievement.key == key))
                .exists()
            )

            if not exists:
                # 新規獲得
                Achievement.create(user=user, key=key)
                
                # イベントログ記録
                try:
                    from utils.event_logger import log_event, EVENT_EARNED_ACHIEVEMENT
                    log_event(user, EVENT_EARNED_ACHIEVEMENT)
                except:
                    pass
                
                return m

    return None


def get_user_achievements(user):
    """
    ユーザーの獲得済みバッジを取得

    Args:
        user: Userオブジェクト

    Returns:
        list: 獲得済みバッジのリスト
    """
    achievements = (
        Achievement.select()
        .where(Achievement.user == user)
        .order_by(Achievement.earned_at.desc())
    )

    badges = []
    for achievement in achievements:
        if achievement.key.startswith('streak_'):
            days = achievement.key.replace('streak_', '')
            badges.append({
                'key': achievement.key,
                'label': f'{days}日継続',
                'earned_at': achievement.earned_at,
            })

    return badges


# バッジ表示用のメタデータ
ACHIEVEMENT_METADATA = {
    'streak_7': {
        'label': '7日継続',
        'description': '1週間連続記録を達成',
        'icon': '🎖️',
    },
    'streak_30': {
        'label': '30日継続',
        'description': '習慣が定着しました',
        'icon': '🏅',
    },
    'streak_100': {
        'label': '100日継続',
        'description': '圧倒的な継続力',
        'icon': '👑',
    },
}


def get_achievement_metadata(key: str) -> dict:
    """
    バッジのメタデータを取得

    Args:
        key: バッジのキー（例: streak_7）

    Returns:
        dict: バッジのメタデータ
    """
    return ACHIEVEMENT_METADATA.get(key, {
        'label': key,
        'description': '',
        'icon': '🏆',
    })
