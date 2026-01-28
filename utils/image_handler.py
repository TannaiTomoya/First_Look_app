"""
画像処理ユーティリティ

project.mdc準拠の画像処理機能:
- 画像形式チェック（JPEG/JPG, PNG, GIF）
- 画像リサイズ（投稿画像: 800x800px、プロフィール画像: 200x200px）
- ファイル名のサニタイズ（UUID使用）
- ファイル保存・削除
"""
import os
import uuid
from PIL import Image, ImageOps

# 許可する画像拡張子
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# 画像サイズ設定
POST_IMAGE_SIZE = (800, 800)  # 投稿画像の最大サイズ
PROFILE_IMAGE_SIZE = (200, 200)  # プロフィール画像のサイズ

# アップロードディレクトリ
UPLOAD_FOLDER = 'static/uploads'
POST_UPLOAD_FOLDER = 'static/uploads/posts'
PROFILE_UPLOAD_FOLDER = 'static/uploads/profiles'
BEFORE_AFTER_UPLOAD_FOLDER = 'static/uploads/before_after'
CHAT_UPLOAD_FOLDER = 'static/uploads/chat'


def allowed_file(filename):
    """
    ファイルが許可された画像形式かチェック

    Args:
        filename (str): ファイル名

    Returns:
        bool: 許可された拡張子の場合True

    Examples:
        >>> allowed_file('photo.jpg')
        True
        >>> allowed_file('document.pdf')
        False
    """
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def generate_unique_filename(original_filename):
    """
    UUIDを使用してユニークなファイル名を生成

    Args:
        original_filename (str): 元のファイル名

    Returns:
        str: ユニークなファイル名

    Examples:
        >>> generate_unique_filename('photo.jpg')
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg'
    """
    # 拡張子を取得
    ext = original_filename.rsplit('.', 1)[1].lower()
    # UUIDを生成してファイル名を作成
    unique_filename = f"{uuid.uuid4()}.{ext}"
    return unique_filename


def resize_image(image, max_size, maintain_aspect=True):
    """
    画像をリサイズ

    Args:
        image (PIL.Image): PILイメージオブジェクト
        max_size (tuple): 最大サイズ (width, height)
        maintain_aspect (bool): アスペクト比を維持するか

    Returns:
        PIL.Image: リサイズされた画像
    """
    if maintain_aspect:
        # アスペクト比を維持してリサイズ
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
    else:
        # 正方形にリサイズ（切り抜き）
        width, height = image.size
        min_dimension = min(width, height)

        # 中央から正方形に切り抜き
        left = (width - min_dimension) // 2
        top = (height - min_dimension) // 2
        right = left + min_dimension
        bottom = top + min_dimension

        image = image.crop((left, top, right, bottom))
        image = image.resize(max_size, Image.Resampling.LANCZOS)

    return image


def save_image(file, image_type='post', maintain_aspect=True):
    """
    画像を保存

    Args:
        file (FileStorage): アップロードされたファイル
        image_type (str): 画像タイプ ('post', 'profile', 'before_after')
        maintain_aspect (bool): アスペクト比を維持するか

    Returns:
        str: 保存されたファイル名（ファイル名のみ）
        None: エラーの場合

    Raises:
        ValueError: ファイルが許可されていない形式の場合
    """
    if not file or not allowed_file(file.filename):
        raise ValueError('許可されていないファイル形式です')

    # ディレクトリの作成
    os.makedirs(POST_UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(PROFILE_UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(BEFORE_AFTER_UPLOAD_FOLDER, exist_ok=True)

    # ファイル名を生成
    filename = generate_unique_filename(file.filename)

    # 保存先とサイズを決定
    if image_type == 'profile':
        upload_folder = PROFILE_UPLOAD_FOLDER
        max_size = PROFILE_IMAGE_SIZE
        maintain_aspect = False  # プロフィール画像は正方形
    elif image_type == 'before_after':
        upload_folder = BEFORE_AFTER_UPLOAD_FOLDER
        max_size = POST_IMAGE_SIZE
    else:
        upload_folder = POST_UPLOAD_FOLDER
        max_size = POST_IMAGE_SIZE

    filepath = os.path.join(upload_folder, filename)

    try:
        # 画像を開く
        image = Image.open(file)
        
        # EXIF情報に基づいて画像を回転（スマホ写真の向き修正）
        try:
            image = ImageOps.exif_transpose(image)
        except Exception:
            # EXIF情報がない場合はそのまま
            pass

        # RGBAをRGBに変換（JPEGで保存できるように）
        if image.mode in ('RGBA', 'LA', 'P'):
            # 透明背景を白に変換
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
            image = background

        # 画像をリサイズ
        image = resize_image(image, max_size, maintain_aspect)

        # 画像を保存
        image.save(filepath, quality=95, optimize=True)

        # ファイル名のみを返す（DBにはファイル名のみ保存）
        return filename

    except Exception as e:
        # エラーが発生した場合、ファイルが存在すれば削除
        if os.path.exists(filepath):
            os.remove(filepath)
        raise ValueError(f'画像の保存中にエラーが発生しました: {str(e)}')


def delete_image(filename, image_type='post'):
    """
    画像を削除

    Args:
        filename (str): ファイル名（相対パスまたはファイル名のみ）
        image_type (str): 画像タイプ ('post' or 'profile')

    Returns:
        bool: 削除成功の場合True

    Examples:
        >>> delete_image('uploads/posts/photo.jpg')
        True
        >>> delete_image('photo.jpg', image_type='profile')
        True
    """
    # デフォルトのプロフィール画像は削除しない
    if filename == 'default.jpg':
        return False

    try:
        # ファイル名のみの場合、フルパスを構築
        if not filename.startswith('static/'):
            if image_type == 'profile':
                filepath = os.path.join(PROFILE_UPLOAD_FOLDER, filename)
            else:
                filepath = os.path.join(POST_UPLOAD_FOLDER, filename)
        else:
            filepath = filename

        # ファイルが存在する場合は削除
        if os.path.exists(filepath):
            os.remove(filepath)
            return True

        return False

    except Exception as e:
        print(f"画像削除エラー: {e}")
        return False


def get_image_info(filepath):
    """
    画像情報を取得

    Args:
        filepath (str): ファイルパス

    Returns:
        dict: 画像情報（width, height, format, size）
        None: エラーの場合
    """
    try:
        with Image.open(filepath) as img:
            return {
                'width': img.width,
                'height': img.height,
                'format': img.format,
                'size': os.path.getsize(filepath)
            }
    except Exception as e:
        print(f"画像情報取得エラー: {e}")
        return None


def validate_image_size(file, max_size_mb=5):
    """
    画像ファイルサイズを検証

    Args:
        file (FileStorage): アップロードされたファイル
        max_size_mb (int): 最大ファイルサイズ（MB）

    Returns:
        bool: サイズが許容範囲内の場合True

    Raises:
        ValueError: ファイルサイズが大きすぎる場合
    """
    # ファイルサイズをチェック
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)  # ファイルポインタを先頭に戻す

    max_size_bytes = max_size_mb * 1024 * 1024

    if size > max_size_bytes:
        raise ValueError(f'ファイルサイズが大きすぎます（最大{max_size_mb}MB）')

    return True


def save_chat_image(file):
    """
    チャット画像を保存

    Args:
        file (FileStorage): アップロードされたファイル

    Returns:
        str: 保存されたファイル名（ファイル名のみ）
        None: エラーの場合

    Raises:
        ValueError: ファイルが許可されていない形式の場合
    """
    if not file or not allowed_file(file.filename):
        raise ValueError('許可されていないファイル形式です')

    # ディレクトリの作成
    os.makedirs(CHAT_UPLOAD_FOLDER, exist_ok=True)

    # ファイル名を生成
    filename = generate_unique_filename(file.filename)
    filepath = os.path.join(CHAT_UPLOAD_FOLDER, filename)

    try:
        # 画像を開く
        image = Image.open(file)
        
        # EXIF情報に基づいて画像を回転（スマホ写真の向き修正）
        try:
            image = ImageOps.exif_transpose(image)
        except Exception:
            # EXIF情報がない場合はそのまま
            pass

        # RGBAをRGBに変換（JPEGで保存できるように）
        if image.mode in ('RGBA', 'LA', 'P'):
            # 透明背景を白に変換
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
            image = background

        # チャット画像は800x800pxまで、アスペクト比維持
        image = resize_image(image, POST_IMAGE_SIZE, maintain_aspect=True)

        # 画像を保存
        image.save(filepath, quality=95, optimize=True)

        # ファイル名のみを返す
        return filename

    except Exception as e:
        # エラーが発生した場合、ファイルが存在すれば削除
        if os.path.exists(filepath):
            os.remove(filepath)
        raise ValueError(f'画像の保存中にエラーが発生しました: {str(e)}')
