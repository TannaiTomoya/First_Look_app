#!/usr/bin/env python
"""
日次リマインダー送信スクリプト

cronジョブで実行:
0 21 * * * cd /path/to/app && python scripts/send_reminders.py
"""

import sys
import os

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.email_reminder import send_daily_reminders

if __name__ == '__main__':
    print("=== 日次リマインダー送信開始 ===")
    send_daily_reminders()
    print("=== 日次リマインダー送信完了 ===")
