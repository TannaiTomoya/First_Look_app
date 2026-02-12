"""
日次リマインダー送信ユーティリティ
"""

from datetime import date
from models.look_record import LookRecord
from models.user import User
from utils.mailer import send_email
import os


def get_users_without_today_record():
    """
    今日の記録がないユーザーを取得

    Returns:
        list: 記録がないユーザーのリスト
    """
    today = date.today()
    users = User.select()
    targets = []

    for user in users:
        # クライアントのみ対象
        if not user.is_client():
            continue

        has_record = (
            LookRecord.select()
            .where((LookRecord.user_id == user.id) & (LookRecord.date == today))
            .exists()
        )

        if not has_record:
            targets.append(user)

    return targets


def send_daily_reminders():
    """
    日次リマインダーを送信

    今日の記録がないユーザーにメールを送信
    """
    users = get_users_without_today_record()

    if not users:
        print("✓ 送信対象ユーザーなし")
        return

    # ドメイン取得（環境変数 or デフォルト）
    domain = os.environ.get('APP_DOMAIN', 'localhost:5000')
    protocol = 'https' if 'localhost' not in domain else 'http'
    dashboard_url = f"{protocol}://{domain}/client/dashboard"

    sent_count = 0
    failed_count = 0

    for user in users:
        subject = "今日の記録がまだありません"
        body = f"""こんにちは、{user.username}さん

今日の記録がまだありません。
1分で終わります。

連続記録を守りましょう。

▼ 記録する
{dashboard_url}

---
FirstLook
"""

        if send_email(to=user.email, subject=subject, body=body):
            sent_count += 1
        else:
            failed_count += 1

    print(f"✓ リマインダー送信完了: 成功={sent_count}, 失敗={failed_count}")
