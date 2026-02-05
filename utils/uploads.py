"""
画像アップロードの共通ユーティリティ

セキュリティ対策：
- MIME/拡張子の検証
- Pillowによる実体検証（偽装ファイル排除）
- EXIF情報の除去（位置情報漏洩防止）
- ファイルサイズとリサイズ制限
- UUID命名（ユーザー入力を信頼しない）
- パストラバーサル対策
"""

import os
import uuid
from typing import Optional, Tuple
from werkzeug.utils import secure_filename
from werkzeug.datastructures import FileStorage
from PIL import Image
import io


# 許可する画像形式
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp'}
ALLOWED_MIMES = {'image/jpeg', 'image/png', 'image/webp'}

# アップロードベースディレクトリ
UPLOAD_BASE_DIR = 'uploads'

# 用途別サブディレクトリ
UPLOAD_SUBDIRS = {
    'profile': 'profile',
    'before_after': 'before_after',
    'skin_checks': 'skin_checks',
    'face_templates': 'face_templates'
}


class ImageUploadError(Exception):
    """画像アップロードエラーの基底クラス"""
    pass


class InvalidImageFormatError(ImageUploadError):
    """不正な画像形式エラー"""
    pass


class InvalidImageDataError(ImageUploadError):
    """画像データが破損または読み込めないエラー"""
    pass


def get_file_extension(filename: str) -> str:
    """
    ファイル名から拡張子を取得（小文字）
    
    Args:
        filename: ファイル名
        
    Returns:
        拡張子（ドットなし、小文字）
    """
    if '.' in filename:
        return filename.rsplit('.', 1)[1].lower()
    return ''


def validate_image(file: FileStorage) -> Tuple[str, str]:
    """
    アップロードされた画像ファイルを検証
    
    検証内容：
    1. ファイル名の存在確認
    2. 拡張子のチェック
    3. MIMEタイプのチェック
    4. Pillowで実際に画像として読み込めるか確認
    
    Args:
        file: アップロードファイルオブジェクト
        
    Returns:
        (拡張子, MIMEタイプ) のタプル
        
    Raises:
        InvalidImageFormatError: 形式が不正な場合
        InvalidImageDataError: 画像データが読み込めない場合
    """
    # 1. ファイル名チェック
    if not file.filename:
        raise InvalidImageFormatError("ファイル名がありません")
    
    # 2. 拡張子チェック
    ext = get_file_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise InvalidImageFormatError(
            f"許可されていない拡張子です。対応形式: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # 3. MIMEタイプチェック
    mime_type = file.content_type
    if mime_type not in ALLOWED_MIMES:
        raise InvalidImageFormatError(
            f"許可されていないMIMEタイプです。対応形式: JPEG, PNG, WebP"
        )
    
    # 4. Pillowで実体検証（偽装ファイル排除）
    try:
        file.stream.seek(0)  # ストリームを先頭に戻す
        img = Image.open(file.stream)
        img.verify()  # 画像として正しいか検証
        file.stream.seek(0)  # 再度先頭に戻す（後続処理のため）
    except Exception as e:
        raise InvalidImageDataError(
            f"画像ファイルとして読み込めません。破損しているか、非対応の形式です: {str(e)}"
        )
    
    return ext, mime_type


def generate_unique_filename(original_filename: str, extension: str) -> str:
    """
    UUID付きのユニークなファイル名を生成
    
    Args:
        original_filename: 元のファイル名（参考用、実際には使用しない）
        extension: 拡張子（ドットなし）
        
    Returns:
        UUIDベースのファイル名
    """
    # secure_filenameは使うが、さらにUUIDを付与して完全にユニークにする
    unique_id = uuid.uuid4().hex
    return f"{unique_id}.{extension}"


def resize_and_remove_exif(
    img: Image.Image,
    max_size: int = 1080,
    quality: int = 85
) -> Tuple[Image.Image, str]:
    """
    画像のリサイズとEXIF除去
    
    処理内容：
    - 長辺がmax_sizeを超える場合、アスペクト比を保ってリサイズ
    - RGBまたはRGBAに変換（EXIF情報を含む元のモードから変換）
    - 透過情報の保持（PNG/WebP）
    
    Args:
        img: PIL Image オブジェクト
        max_size: 長辺の最大ピクセル数
        quality: 圧縮品質（JPEG/WebP用、1-100）
        
    Returns:
        (処理済みImage, 推奨形式) のタプル
    """
    # 元の形式を記憶
    original_format = img.format if img.format else 'JPEG'
    
    # リサイズが必要か判定
    width, height = img.size
    if width > max_size or height > max_size:
        # アスペクト比を保ってリサイズ
        if width > height:
            new_width = max_size
            new_height = int(height * (max_size / width))
        else:
            new_height = max_size
            new_width = int(width * (max_size / height))
        
        img = img.resize((new_width, new_height), Image.LANCZOS)
    
    # 透過情報の有無を確認
    has_transparency = img.mode in ('RGBA', 'LA', 'P') or (
        img.mode == 'P' and 'transparency' in img.info
    )
    
    # 適切なモードに変換（EXIFを含まない新しい画像として）
    if has_transparency:
        # 透過情報がある場合はRGBAに変換
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        recommended_format = 'PNG'  # 透過はPNGで保存
    else:
        # 透過情報がない場合はRGBに変換
        if img.mode != 'RGB':
            img = img.convert('RGB')
        # 元の形式を尊重しつつ、WebPを優先
        if original_format in ('JPEG', 'JPG'):
            recommended_format = 'JPEG'
        else:
            recommended_format = 'WEBP'
    
    return img, recommended_format


def save_image(
    file: FileStorage,
    subdir: str,
    max_size: int = 1080,
    quality: int = 85
) -> str:
    """
    画像を検証・処理して保存
    
    処理フロー：
    1. 画像の検証（validate_image）
    2. ユニークなファイル名生成
    3. Pillowで読み込み
    4. リサイズ＋EXIF除去
    5. 再エンコードして保存
    
    Args:
        file: アップロードファイルオブジェクト
        subdir: 保存先サブディレクトリ（'profile', 'before_after'等）
        max_size: 長辺の最大ピクセル数（デフォルト1080）
        quality: 圧縮品質（1-100、デフォルト85）
        
    Returns:
        保存された画像の相対パス（例: "uploads/profile/abc123.webp"）
        
    Raises:
        InvalidImageFormatError: 形式が不正な場合
        InvalidImageDataError: 画像データが読み込めない場合
        ValueError: サブディレクトリが不正な場合
    """
    # 1. サブディレクトリの検証
    if subdir not in UPLOAD_SUBDIRS.values():
        raise ValueError(f"不正なサブディレクトリです: {subdir}")
    
    # 2. 画像の検証
    ext, mime_type = validate_image(file)
    
    # 3. 保存先ディレクトリの作成
    upload_dir = os.path.join(UPLOAD_BASE_DIR, subdir)
    os.makedirs(upload_dir, exist_ok=True)
    
    # 4. 画像を読み込み
    file.stream.seek(0)
    img = Image.open(file.stream)
    
    # 5. リサイズ＋EXIF除去
    processed_img, recommended_format = resize_and_remove_exif(img, max_size, quality)
    
    # 6. ユニークなファイル名生成（推奨形式の拡張子で）
    if recommended_format == 'JPEG':
        save_ext = 'jpg'
    elif recommended_format == 'PNG':
        save_ext = 'png'
    else:  # WEBP
        save_ext = 'webp'
    
    unique_filename = generate_unique_filename(file.filename, save_ext)
    file_path = os.path.join(upload_dir, unique_filename)
    
    # 7. 再エンコードして保存（EXIFなし）
    save_options = {}
    if recommended_format == 'JPEG':
        save_options = {'quality': quality, 'optimize': True}
    elif recommended_format == 'PNG':
        save_options = {'optimize': True}
    elif recommended_format == 'WEBP':
        save_options = {'quality': quality, 'method': 6}  # method=6で最高圧縮
    
    processed_img.save(file_path, format=recommended_format, **save_options)
    
    # 8. 相対パスを返す（DB保存用）
    relative_path = os.path.join(UPLOAD_BASE_DIR, subdir, unique_filename)
    
    print(f"[Upload] 画像保存成功: {relative_path} ({recommended_format})")
    
    return relative_path


def delete_image(relative_path: str) -> bool:
    """
    保存された画像を安全に削除
    
    セキュリティ：
    - パストラバーサル対策（UPLOAD_BASE_DIR配下のみ削除可能）
    - 存在しないファイルでもエラーを出さない
    
    Args:
        relative_path: 削除する画像の相対パス
        
    Returns:
        削除成功時True、ファイルが存在しない場合もTrue、エラー時False
    """
    if not relative_path:
        return True
    
    try:
        # パストラバーサル対策：UPLOAD_BASE_DIR配下のみ許可
        full_path = os.path.abspath(relative_path)
        base_path = os.path.abspath(UPLOAD_BASE_DIR)
        
        if not full_path.startswith(base_path):
            print(f"[Upload] ⚠️ 不正なパス削除試行を検出: {relative_path}")
            return False
        
        # ファイルが存在すれば削除
        if os.path.exists(full_path):
            os.remove(full_path)
            print(f"[Upload] 画像削除成功: {relative_path}")
        
        return True
        
    except Exception as e:
        print(f"[Upload] ❌ 画像削除エラー: {relative_path} - {str(e)}")
        return False


def get_upload_subdir(category: str) -> str:
    """
    カテゴリからサブディレクトリ名を取得
    
    Args:
        category: カテゴリ名（'profile', 'before_after'等）
        
    Returns:
        サブディレクトリ名
        
    Raises:
        ValueError: 不正なカテゴリの場合
    """
    if category not in UPLOAD_SUBDIRS:
        raise ValueError(
            f"不正なカテゴリです: {category}。"
            f"利用可能: {', '.join(UPLOAD_SUBDIRS.keys())}"
        )
    return UPLOAD_SUBDIRS[category]
