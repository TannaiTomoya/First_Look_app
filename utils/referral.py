"""
招待（Referral）機能ユーティリティ
"""

import secrets
from models.user import User


def generate_referral_code() -> str:
    """
    ユニークな招待コードを生成

    Returns:
        str: 8文字の招待コード
    """
    while True:
        code = secrets.token_hex(4).upper()  # 8文字（大文字）
        
        # ユニークチェック
        exists = User.select().where(User.referral_code == code).exists()
        if not exists:
            return code


def process_referral(new_user, referral_code: str) -> bool:
    """
    招待処理を実行

    Args:
        new_user: 新規ユーザー
        referral_code: 招待コード

    Returns:
        bool: 処理成功時True
    """
    try:
        # 紹介者を検索
        referrer = User.get_or_none(User.referral_code == referral_code)
        
        if not referrer:
            return False
        
        # 自己紹介防止
        if referrer.id == new_user.id:
            return False
        
        # 紹介関係を設定
        new_user.referred_by_id = referrer.id
        new_user.save()
        
        # 両者にFreeze +1
        referrer.streak_freeze = min(referrer.streak_freeze + 1, 3)  # 最大3
        referrer.save()
        
        new_user.streak_freeze = min(new_user.streak_freeze + 1, 3)  # 最大3
        new_user.save()
        
        return True
        
    except Exception as e:
        print(f"[Referral] 処理エラー: {str(e)}")
        return False


def get_referral_stats(user) -> dict:
    """
    招待統計を取得

    Args:
        user: Userオブジェクト

    Returns:
        dict: 招待統計
    """
    referred_users = user.get_referred_users()
    
    return {
        'referral_code': user.referral_code,
        'referred_count': referred_users.count(),
        'referred_users': list(referred_users),
    }
