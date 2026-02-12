"""
イベントログ記録ユーティリティ
"""

from models.event_log import EventLog


def log_event(user, event: str):
    """
    イベントをログに記録

    Args:
        user: Userオブジェクト（None可）
        event: イベント名（例: signup, saved_record）
    """
    try:
        EventLog.create(
            user=user,
            event=event
        )
    except Exception as e:
        # ログ記録失敗してもアプリは継続
        print(f"[EventLog] 記録失敗: {event} - {str(e)}")


# 主要イベント定義
EVENT_SIGNUP = "signup"
EVENT_SAVED_RECORD = "saved_record"
EVENT_COMPLETED_DAILY_ACTION = "completed_daily_action"
EVENT_GENERATED_PROGRESS_CARD = "generated_progress_card"
EVENT_SENT_REFERRAL = "sent_referral"
EVENT_USED_FREEZE = "used_freeze"
EVENT_EARNED_ACHIEVEMENT = "earned_achievement"
