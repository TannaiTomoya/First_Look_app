"""
Gemini API用の画像処理ユーティリティ

画像の圧縮・リサイズを行い、API通信のペイロードサイズを最適化します。
参考: https://note.com/satoru666/n/n08e754f7313e
"""
from PIL import Image
import base64
import io
from typing import Tuple, Optional


def resize_and_compress_image(
    image_data: str,
    max_size: int = 360,
    quality: int = 40
) -> Tuple[str, dict]:
    """
    画像をリサイズ・圧縮してbase64形式で返す
    
    Args:
        image_data: base64エンコードされた画像データ（data:image/...;base64,... 形式）
        max_size: 最大サイズ（ピクセル）
        quality: JPEG品質（1-100）
    
    Returns:
        tuple: (圧縮済みbase64データ, メタデータ辞書)
    
    Raises:
        ValueError: 画像処理エラー
    """
    try:
        # base64ヘッダーを分離
        if ',' in image_data:
            header, encoded = image_data.split(',', 1)
        else:
            raise ValueError("無効な画像データ形式です")
        
        # base64デコード
        img_bytes = base64.b64decode(encoded)
        original_size = len(img_bytes)
        
        # Pillowで画像を開く
        img = Image.open(io.BytesIO(img_bytes))
        original_width, original_height = img.size
        
        # RGBに変換（透過PNGなどへの対応）
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        
        # リサイズ（アスペクト比維持）
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        new_width, new_height = img.size
        
        # JPEG圧縮
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
        buffer.seek(0)
        
        # base64エンコード
        compressed_bytes = buffer.getvalue()
        compressed_size = len(compressed_bytes)
        compressed_b64 = base64.b64encode(compressed_bytes).decode('utf-8')
        
        # メタデータ
        metadata = {
            'original_size': original_size,
            'compressed_size': compressed_size,
            'original_dimensions': (original_width, original_height),
            'new_dimensions': (new_width, new_height),
            'compression_ratio': round((1 - compressed_size / original_size) * 100, 2)
        }
        
        return f"data:image/jpeg;base64,{compressed_b64}", metadata
        
    except Exception as e:
        raise ValueError(f"画像処理エラー: {str(e)}")


def validate_image_data(image_data: str) -> bool:
    """
    画像データのバリデーション
    
    Args:
        image_data: base64エンコードされた画像データ
    
    Returns:
        bool: 有効な場合True
    """
    try:
        if not image_data:
            return False
        
        if not image_data.startswith('data:image/'):
            return False
        
        if ',' not in image_data:
            return False
        
        # base64デコードを試行
        _, encoded = image_data.split(',', 1)
        base64.b64decode(encoded)
        
        return True
        
    except Exception:
        return False


def get_image_size_mb(image_data: str) -> float:
    """
    画像データのサイズをMB単位で取得
    
    Args:
        image_data: base64エンコードされた画像データ
    
    Returns:
        float: サイズ（MB）
    """
    try:
        if ',' in image_data:
            _, encoded = image_data.split(',', 1)
        else:
            encoded = image_data
        
        img_bytes = base64.b64decode(encoded)
        return len(img_bytes) / (1024 * 1024)
        
    except Exception:
        return 0.0
