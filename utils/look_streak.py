"""
LookRecord ストリーク計算ユーティリティ
"""

from datetime import date, timedelta
from models.look_record import LookRecord


def calculate_current_streak(user_id: int) -> int:
    """
    現在のストリーク（連続記録日数）を計算

    Args:
        user_id: ユーザーID

    Returns:
        int: 現在のストリーク日数
    """
    today = date.today()
    streak = 0

    for i in range(365):
        day = today - timedelta(days=i)

        exists = (
            LookRecord.select()
            .where((LookRecord.user_id == user_id) & (LookRecord.date == day))
            .exists()
        )

        if exists:
            streak += 1
        else:
            break

    return streak


def calculate_current_streak_with_freeze(user) -> int:
    """
    Freezeを考慮した現在のストリーク（連続記録日数）を計算

    Args:
        user: Userオブジェクト

    Returns:
        int: 現在のストリーク日数（Freeze使用分を含む）
    """
    today = date.today()
    streak = 0
    freeze_available = user.streak_freeze

    for i in range(365):
        day = today - timedelta(days=i)

        exists = (
            LookRecord.select()
            .where((LookRecord.user_id == user.id) & (LookRecord.date == day))
            .exists()
        )

        if exists:
            streak += 1
            continue

        # 記録なし → Freeze使用判定
        if freeze_available > 0:
            freeze_available -= 1
            streak += 1
            continue

        break

    return streak


def calculate_longest_streak(user_id: int) -> int:
    """
    最長ストリーク（過去最高の連続記録日数）を計算

    Args:
        user_id: ユーザーID

    Returns:
        int: 最長ストリーク日数
    """
    records = LookRecord.select().where(LookRecord.user_id == user_id).order_by(LookRecord.date)

    if not records.exists():
        return 0

    longest = 0
    current = 0
    prev_date = None

    for r in records:
        if prev_date and r.date == prev_date + timedelta(days=1):
            current += 1
        else:
            current = 1

        longest = max(longest, current)
        prev_date = r.date

    return longest


def has_record_today(user_id: int) -> bool:
    """
    今日の記録が存在するかチェック

    Args:
        user_id: ユーザーID

    Returns:
        bool: 今日の記録があればTrue
    """
    return (
        LookRecord.select()
        .where((LookRecord.user_id == user_id) & (LookRecord.date == date.today()))
        .exists()
    )


def consume_freeze_if_needed(user):
    """
    必要に応じてFreezeを消費

    記録してない状態で日付が変わったらFreezeを自動消費

    Args:
        user: Userオブジェクト
    """
    today = date.today()

    # 今日の記録があればスキップ
    has_today = has_record_today(user.id)
    if has_today:
        return

    # Freezeが無ければスキップ
    if user.streak_freeze <= 0:
        return

    # 今日既にFreezeを使用済みならスキップ
    if user.last_freeze_used_at == today:
        return

    # Freeze消費
    user.streak_freeze -= 1
    user.last_freeze_used_at = today
    user.save()

    # イベントログ記録
    try:
        from utils.event_logger import log_event, EVENT_USED_FREEZE
        log_event(user, EVENT_USED_FREEZE)
    except:
        pass  # ログ失敗してもFreeze消費は成功


def refill_freeze(user, streak: int):
    """
    Freezeを補充

    1週間継続で+1回復。最大2。

    Args:
        user: Userオブジェクト
        streak: 現在のストリーク日数
    """
    if streak % 7 == 0 and streak > 0 and user.streak_freeze < 2:
        user.streak_freeze += 1
        user.save()

