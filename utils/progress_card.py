"""
Progress Card（進化カード）生成モジュール
Before/After画像を1枚に合成してSNS共有用画像を作成
"""
from PIL import Image, ImageDraw, ImageFont
import os


def generate_progress_card(first_record, latest_record, output_path: str) -> bool:
    """
    進化カードを生成

    Args:
        first_record: 最初のLookRecord
        latest_record: 最新のLookRecord
        output_path: 出力先パス

    Returns:
        成功ならTrue
    """
    try:
        # キャンバスサイズ
        WIDTH = 1080
        HEIGHT = 1080

        # 背景色（白）
        canvas = Image.new('RGB', (WIDTH, HEIGHT), color='#FFFFFF')
        draw = ImageDraw.Draw(canvas)

        # ========================================
        # タイトル描画
        # ========================================

        title_text = "My Face Progress"
        title_y = 60

        # タイトルフォント（大きめ）
        try:
            # システムフォント使用（日本語対応）
            title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 60)
        except (OSError, IOError):
            title_font = ImageFont.load_default()

        # タイトル中央配置
        title_bbox = draw.textbbox((0, 0), title_text, font=title_font)
        title_width = title_bbox[2] - title_bbox[0]
        title_x = (WIDTH - title_width) // 2

        draw.text((title_x, title_y), title_text, fill='#333333', font=title_font)

        # ========================================
        # 画像配置（Before/After）
        # ========================================

        # 画像領域
        image_top = 180
        image_size = 450  # 各画像のサイズ
        gap = 30  # 画像間のギャップ

        # Before画像（左）
        try:
            before_img = Image.open(first_record.photo_path).convert('RGB')
            before_img = before_img.resize((image_size, image_size), Image.Resampling.LANCZOS)
            before_x = (WIDTH - (image_size * 2 + gap)) // 2
            canvas.paste(before_img, (before_x, image_top))

            # "Before"ラベル
            label_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 30)
            draw.text((before_x + 10, image_top + 10), "Before", fill='#FFFFFF', font=label_font)
        except (OSError, IOError, Exception):
            pass

        # After画像（右）
        try:
            after_img = Image.open(latest_record.photo_path).convert('RGB')
            after_img = after_img.resize((image_size, image_size), Image.Resampling.LANCZOS)
            after_x = before_x + image_size + gap
            canvas.paste(after_img, (after_x, image_top))

            # "After"ラベル
            draw.text((after_x + 10, image_top + 10), "After", fill='#FFFFFF', font=label_font)
        except (OSError, IOError, Exception):
            pass

        # ========================================
        # スコア変化描画
        # ========================================

        score_y = image_top + image_size + 80

        # スコアフォント
        score_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 50)

        # スコア差分
        score_diff = latest_record.score_total - first_record.score_total
        score_text = f"Clean Score: {first_record.score_total} → {latest_record.score_total}"

        if score_diff > 0:
            score_text += f" (+{score_diff})"
            score_color = '#10B981'  # 緑
        elif score_diff < 0:
            score_text += f" ({score_diff})"
            score_color = '#EF4444'  # 赤
        else:
            score_text += " (±0)"
            score_color = '#6B7280'  # グレー

        # スコア中央配置
        score_bbox = draw.textbbox((0, 0), score_text, font=score_font)
        score_width = score_bbox[2] - score_bbox[0]
        score_x = (WIDTH - score_width) // 2

        draw.text((score_x, score_y), score_text, fill=score_color, font=score_font)

        # ========================================
        # 経過日数描画
        # ========================================

        days_y = score_y + 80

        # 経過日数
        days_elapsed = (latest_record.date - first_record.date).days
        days_text = f"Day {days_elapsed} Progress"

        # 小さめフォント
        days_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 35)

        # 中央配置
        days_bbox = draw.textbbox((0, 0), days_text, font=days_font)
        days_width = days_bbox[2] - days_bbox[0]
        days_x = (WIDTH - days_width) // 2

        draw.text((days_x, days_y), days_text, fill='#9CA3AF', font=days_font)

        # ========================================
        # ロゴ・署名（任意）
        # ========================================

        logo_y = HEIGHT - 60
        logo_text = "FirstLook"
        logo_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 25)

        logo_bbox = draw.textbbox((0, 0), logo_text, font=logo_font)
        logo_width = logo_bbox[2] - logo_bbox[0]
        logo_x = (WIDTH - logo_width) // 2

        draw.text((logo_x, logo_y), logo_text, fill='#D1D5DB', font=logo_font)

        # ========================================
        # 保存
        # ========================================

        # ディレクトリ作成
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # 保存
        canvas.save(output_path, format='PNG', optimize=True, quality=95)

        return True

    except Exception as e:
        print(f"[Progress Card] 生成エラー: {e}")
        return False
