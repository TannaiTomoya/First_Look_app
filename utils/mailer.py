"""
メール送信ユーティリティ
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_email(to: str, subject: str, body: str) -> bool:
    """
    メール送信

    Args:
        to: 送信先メールアドレス
        subject: 件名
        body: 本文

    Returns:
        bool: 送信成功時True
    """
    try:
        # 環境変数から設定取得
        smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
        smtp_port = int(os.environ.get('SMTP_PORT', 587))
        smtp_user = os.environ.get('SMTP_USER')
        smtp_password = os.environ.get('SMTP_PASSWORD')
        from_email = os.environ.get('SMTP_FROM', smtp_user)

        # 設定チェック
        if not smtp_user or not smtp_password:
            print("⚠️ SMTP設定が不足しています（SMTP_USER, SMTP_PASSWORD）")
            return False

        # メッセージ作成
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = to
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain', 'utf-8'))

        # SMTP接続・送信
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)

        print(f"✓ メール送信成功: {to}")
        return True

    except Exception as e:
        print(f"✗ メール送信失敗: {to} - {str(e)}")
        return False
