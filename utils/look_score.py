"""
Look Records スコア算出モジュール
画像から決定論的にスコアを算出（0-100）
"""
from PIL import Image
import numpy as np


def compute_look_scores(image_path: str) -> dict:
    """
    画像からスコアを算出

    Args:
        image_path: 保存済み画像のパス

    Returns:
        {
            'contour': 0-100,
            'skin': 0-100,
            'young': 0-100,
            'total': 0-100
        }
    """
    try:
        img = Image.open(image_path).convert('RGB')
        img_array = np.array(img)

        # 各スコアを算出
        contour_score = compute_contour_score(img_array)
        skin_score = compute_skin_score(img_array)
        young_score = compute_young_score(img_array)

        # 総合スコア（加重平均）
        # 肌50% + 輪郭30% + 若見え20%
        total_score = int(
            skin_score * 0.5 +
            contour_score * 0.3 +
            young_score * 0.2
        )

        return {
            'contour': contour_score,
            'skin': skin_score,
            'young': young_score,
            'total': total_score
        }

    except Exception as e:
        # エラー時はデフォルトスコア
        print(f"[Look Score] スコア算出エラー: {e}")
        return {
            'contour': 50,
            'skin': 50,
            'young': 50,
            'total': 50
        }


def compute_contour_score(img_array: np.ndarray) -> int:
    """
    輪郭シャープ度を算出

    簡易実装:
    - 画像の縦横比から顔の細さを推定
    - エッジ検出で輪郭の明瞭さを評価

    Returns:
        0-100のスコア
    """
    height, width = img_array.shape[:2]

    # 縦横比スコア（細長いほど高スコア）
    aspect_ratio = height / width if width > 0 else 1.0
    aspect_score = min(100, int(aspect_ratio * 80))

    # 中央部のエッジ強度（輪郭のシャープさ）
    center_region = img_array[
        height // 4:3 * height // 4,
        width // 4:3 * width // 4
    ]

    # グレースケール変換
    gray = np.mean(center_region, axis=2).astype(np.uint8)

    # Sobelフィルタ近似（簡易エッジ検出）
    dx = np.diff(gray, axis=1)
    dy = np.diff(gray, axis=0)
    edge_strength = np.mean(np.abs(dx)) + np.mean(np.abs(dy))

    # エッジ強度を0-100にマッピング（経験的な閾値）
    edge_score = min(100, int(edge_strength * 2))

    # 総合（平均）
    score = int((aspect_score + edge_score) / 2)

    return max(0, min(100, score))


def compute_skin_score(img_array: np.ndarray) -> int:
    """
    肌の整い度を算出

    簡易実装:
    - 中央部の明るさ
    - 色のばらつき（なめらかさ）

    Returns:
        0-100のスコア
    """
    height, width = img_array.shape[:2]

    # 顔中央部を対象（上半分の中央）
    face_region = img_array[
        height // 6:height // 2,
        width // 3:2 * width // 3
    ]

    # 明るさスコア（平均輝度）
    brightness = np.mean(face_region)
    brightness_score = min(100, int((brightness / 255) * 120))

    # なめらかさスコア（標準偏差の逆数）
    std_dev = np.std(face_region)
    smoothness_score = max(0, 100 - int(std_dev * 1.5))

    # 彩度スコア（色の鮮やかさ）
    r, g, b = face_region[:, :, 0], face_region[:, :, 1], face_region[:, :, 2]
    saturation = np.std([np.mean(r), np.mean(g), np.mean(b)])
    saturation_score = min(100, int(saturation * 3))

    # 総合（明るさ40% + なめらかさ50% + 彩度10%）
    score = int(
        brightness_score * 0.4 +
        smoothness_score * 0.5 +
        saturation_score * 0.1
    )

    return max(0, min(100, score))


def compute_young_score(img_array: np.ndarray) -> int:
    """
    若見え度を算出

    簡易実装:
    - ほうれい線周辺（口から頬へのライン）のコントラスト
    - コントラストが低いほど高スコア

    Returns:
        0-100のスコア
    """
    height, width = img_array.shape[:2]

    # ほうれい線想定領域（顔の下半分の両側）
    left_line = img_array[
        height // 2:3 * height // 4,
        width // 4:width // 2
    ]
    right_line = img_array[
        height // 2:3 * height // 4,
        width // 2:3 * width // 4
    ]

    # グレースケール変換
    left_gray = np.mean(left_line, axis=2)
    right_gray = np.mean(right_line, axis=2)

    # 局所コントラスト（縦方向の明暗差）
    left_contrast = np.std(np.diff(left_gray, axis=0))
    right_contrast = np.std(np.diff(right_gray, axis=0))

    avg_contrast = (left_contrast + right_contrast) / 2

    # コントラストが低いほど高スコア（シワが少ない）
    # 経験的な閾値でマッピング
    score = max(0, 100 - int(avg_contrast * 5))

    return max(0, min(100, score))
