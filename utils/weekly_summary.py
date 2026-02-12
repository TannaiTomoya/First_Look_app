"""
週間サマリー用のユーティリティ関数
"""


def build_weekly_comment(avg_total, week_delta, best, worst):
    """
    週間データからAIコーチコメントを生成

    Args:
        avg_total: 平均スコア
        week_delta: 週間の伸び（最初→最後）
        best: ベスト記録
        worst: ワースト記録

    Returns:
        str: コメント文字列
    """
    if week_delta >= 6:
        return "伸びてる。今週の勝ち筋は維持。次は弱い指標を詰めよう。"
    if week_delta >= 1:
        return "微増。伸びた日は何をやったか再現して、ムラを減らす。"
    if week_delta == 0:
        return "停滞。やることを増やすより、同じことを続けて精度を上げよう。"
    return "落ちてる。原因は必ずある。睡眠・肌・姿勢のどれかを固定で改善。"


def choose_next_focus(avg_contour: int, avg_skin: int, avg_young: int) -> dict:
    """
    来週の重点指標を選択

    Args:
        avg_contour: 輪郭の平均スコア
        avg_skin: 肌の平均スコア
        avg_young: 若見えの平均スコア

    Returns:
        dict: {"focus": "指標名", "tip": "アドバイス"}
    """
    scores = {
        "輪郭": avg_contour,
        "肌": avg_skin,
        "若見え": avg_young,
    }

    focus = min(scores, key=scores.get)

    tips = {
        "輪郭": "姿勢・水分・塩分を固定。顔のむくみを止めろ。",
        "肌": "睡眠7hと保湿を毎日固定。新しいことは増やすな。",
        "若見え": "口角・表情・顔の力を抜く習慣を優先。",
    }

    return {
        "focus": focus,
        "tip": tips[focus]
    }
