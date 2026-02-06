"""
サーバ側画像合成エンジン（Step4）
Pillowを使った高品質レンダリング

Step4-B: 単一の公開関数 render_export() でmeta→PNG生成
"""
from PIL import Image, ImageDraw
import os
import math
import json


class RenderEngine:
    """顔パーツ合成エンジン"""
    
    def __init__(self, upload_dir):
        """
        Args:
            upload_dir: アップロードディレクトリのベースパス
        """
        self.upload_dir = upload_dir
        self.max_output_size = 1600  # 最大出力幅（ピクセル）
    
    def render(self, base_image_path, parts, state, anchors, output_format='PNG'):
        """
        画像を合成してレンダリング
        
        Args:
            base_image_path: ベース画像パス（相対パス）
            parts: パーツ情報 { 'leftBrow': {'path': '...'}, 'rightBrow': {...}, 'nose': {...} }
            state: 調整state { 'parts': { 'leftBrow': {dx, dy, scale, rotate, opacity}, ... } }
            anchors: アンカー座標 { 'leftBrow': {cx, cy, w, h}, ... }
            output_format: 出力フォーマット（'PNG' or 'JPEG'）
        
        Returns:
            PIL.Image: 合成済み画像
        """
        # ベース画像を読み込み
        base_full_path = os.path.join(self.upload_dir, base_image_path)
        base_img = Image.open(base_full_path).convert('RGBA')
        
        # サイズ制限（重すぎる画像を縮小）
        if base_img.width > self.max_output_size:
            scale_factor = self.max_output_size / base_img.width
            new_size = (self.max_output_size, int(base_img.height * scale_factor))
            base_img = base_img.resize(new_size, Image.Resampling.LANCZOS)
            
            # anchorsもスケール調整
            anchors = self._scale_anchors(anchors, scale_factor)
        
        # 合成用キャンバス
        canvas = base_img.copy()
        
        # レイヤ順: rightBrow → leftBrow → nose
        render_order = ['rightBrow', 'leftBrow', 'nose']
        
        for part_key in render_order:
            if part_key not in parts or not parts[part_key]:
                continue
            
            part_path = parts[part_key].get('path')
            if not part_path:
                continue
            
            part_full_path = os.path.join(self.upload_dir, part_path)
            if not os.path.exists(part_full_path):
                print(f'[RenderEngine] パーツ画像が見つかりません: {part_full_path}')
                continue
            
            # パーツ画像を読み込み
            part_img = Image.open(part_full_path).convert('RGBA')
            
            # state取得
            adjustment = state['parts'].get(part_key, {
                'dx': 0, 'dy': 0, 'scale': 1.0, 'rotate': 0, 'opacity': 1.0
            })
            
            # anchor取得
            anchor = anchors.get(part_key)
            if not anchor:
                print(f'[RenderEngine] アンカーが見つかりません: {part_key}')
                continue
            
            # パーツを合成
            canvas = self._composite_part(
                canvas,
                part_img,
                anchor,
                adjustment
            )
        
        # 出力フォーマットに変換
        if output_format == 'JPEG':
            # JPEGはRGBのみ
            final_img = Image.new('RGB', canvas.size, (255, 255, 255))
            final_img.paste(canvas, mask=canvas.split()[3])  # アルファチャンネルをマスクに
            return final_img
        else:
            # PNG（RGBA）
            return canvas
    
    def _composite_part(self, canvas, part_img, anchor, adjustment):
        """
        パーツを合成
        
        Args:
            canvas: ベース画像
            part_img: パーツ画像（RGBA）
            anchor: アンカー座標 {cx, cy, w, h} or {x, y, w, h}
            adjustment: 調整値 {dx, dy, scale, rotate, opacity}
        
        Returns:
            PIL.Image: 合成後の画像
        """
        # cx,cy形式とx,y形式の両方に対応
        anchor_cx = anchor.get('cx', anchor.get('x', 0))
        anchor_cy = anchor.get('cy', anchor.get('y', 0))
        anchor_w = anchor.get('w', 0)
        anchor_h = anchor.get('h', 0)
        
        if anchor_w <= 0 or anchor_h <= 0:
            print(f'[RenderEngine] 不正なアンカーサイズ: w={anchor_w}, h={anchor_h}')
            return canvas
        
        # アンカーサイズに合わせてスケール
        base_scale = anchor_w / part_img.width
        final_scale = base_scale * adjustment.get('scale', 1.0)
        
        new_width = int(part_img.width * final_scale)
        new_height = int(part_img.height * final_scale)
        
        if new_width <= 0 or new_height <= 0:
            return canvas  # サイズ不正ならスキップ
        
        # リサイズ
        resized = part_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # 回転（中心回転、expand=Trueで欠け防止）
        rotate_deg = adjustment.get('rotate', 0)
        if rotate_deg != 0:
            resized = resized.rotate(-rotate_deg, expand=True, resample=Image.Resampling.BICUBIC)
        
        # 透明度調整
        opacity = adjustment.get('opacity', 1.0)
        if opacity < 1.0:
            alpha = resized.split()[3]  # アルファチャンネル
            alpha = alpha.point(lambda p: int(p * opacity))
            resized.putalpha(alpha)
        
        # 配置座標計算（アンカー中心 + 調整オフセット）
        dx = adjustment.get('dx', 0)
        dy = adjustment.get('dy', 0)
        final_cx = int(anchor_cx + dx)
        final_cy = int(anchor_cy + dy)
        
        # パーツの左上座標
        paste_x = final_cx - resized.width // 2
        paste_y = final_cy - resized.height // 2
        
        # 範囲外チェック（clamp）
        if paste_x + resized.width > canvas.width:
            paste_x = canvas.width - resized.width
        if paste_y + resized.height > canvas.height:
            paste_y = canvas.height - resized.height
        paste_x = max(0, paste_x)
        paste_y = max(0, paste_y)
        
        # 合成
        try:
            canvas.paste(resized, (paste_x, paste_y), resized)
        except Exception as e:
            print(f'[RenderEngine] 合成エラー: {e}')
        
        return canvas
    
    def _scale_anchors(self, anchors, scale_factor):
        """アンカー座標をスケール調整"""
        scaled = {}
        for key, anchor in anchors.items():
            scaled[key] = {
                'cx': anchor['cx'] * scale_factor,
                'cy': anchor['cy'] * scale_factor,
                'w': anchor['w'] * scale_factor,
                'h': anchor['h'] * scale_factor
            }
        return scaled
    
    def save_export(self, image, user_id, export_id, format='PNG'):
        """
        エクスポート画像を保存
        
        Args:
            image: PIL.Image
            user_id: ユーザーID
            export_id: エクスポートID
            format: 'PNG' or 'JPEG'
        
        Returns:
            str: 保存パス（相対パス）
        """
        # 保存先ディレクトリ
        export_dir = os.path.join(self.upload_dir, 'exports', str(user_id))
        os.makedirs(export_dir, exist_ok=True)
        
        # ファイル名（ユーザー入力を使わない）
        ext = 'png' if format == 'PNG' else 'jpg'
        filename = f'{export_id}.{ext}'
        file_path = os.path.join(export_dir, filename)
        
        # 保存
        if format == 'PNG':
            image.save(file_path, 'PNG', optimize=True)
        else:
            image.save(file_path, 'JPEG', quality=90, optimize=True)
        
        # 相対パスを返す
        relative_path = os.path.join('exports', str(user_id), filename)
        return relative_path


# ========================================
# Step4-B: 単一公開関数（単体テスト可能）
# ========================================

def render_export(meta, output_png_path, upload_dir):
    """
    Export用の統一レンダリング関数
    
    Args:
        meta: dict - エクスポートメタ情報
            {
                "template_id": int,
                "base_image_path": str,  # 相対パス
                "parts": {
                    "leftBrow": {"path": "..."} or None,
                    "rightBrow": {"path": "..."} or None,
                    "nose": {"path": "..."} or None
                },
                "anchors": {
                    "leftBrow": {"x": float, "y": float, "w": float, "h": float},
                    "rightBrow": {...},
                    "nose": {...}
                },
                "state": {
                    "eyebrow": {
                        "left": {"dx": 0, "dy": 0, "scale": 1.0, "rotate": 0, "opacity": 1.0},
                        "right": {...}
                    },
                    "nose": {"dx": 0, "dy": 0, "scale": 1.0, "rotate": 0, "opacity": 1.0}
                }
            }
        output_png_path: str - 出力PNG絶対パス
        upload_dir: str - アップロードディレクトリのベースパス
    
    Returns:
        None - PNG生成成功
    
    Raises:
        Exception - 生成失敗時
    """
    # ベース画像パス
    base_image_path = meta.get('base_image_path')
    if not base_image_path:
        raise ValueError('base_image_path が見つかりません')
    
    base_full_path = os.path.join(upload_dir, base_image_path)
    if not os.path.exists(base_full_path):
        raise FileNotFoundError(f'ベース画像が見つかりません: {base_full_path}')
    
    # ベース画像読み込み
    base_img = Image.open(base_full_path).convert('RGBA')
    
    # サイズ制限（最大1600px幅）
    max_width = 1600
    scale_factor = 1.0
    if base_img.width > max_width:
        scale_factor = max_width / base_img.width
        new_size = (max_width, int(base_img.height * scale_factor))
        base_img = base_img.resize(new_size, Image.Resampling.LANCZOS)
    
    # anchors取得とスケール調整
    anchors = meta.get('anchors', {})
    if scale_factor != 1.0:
        anchors = _scale_anchors_simple(anchors, scale_factor)
    
    # state取得
    state_raw = meta.get('state', {})
    
    # state形式を統一（eyebrow.left/right → parts.leftBrow/rightBrow）
    state = _normalize_state_format(state_raw)
    
    # parts取得
    parts = meta.get('parts', {})
    
    # 合成用キャンバス
    canvas = base_img.copy()
    
    # レイヤ順: rightBrow → leftBrow → nose
    render_order = ['rightBrow', 'leftBrow', 'nose']
    
    for part_key in render_order:
        if part_key not in parts or not parts[part_key]:
            continue
        
        part_info = parts[part_key]
        part_path = part_info.get('path') if isinstance(part_info, dict) else None
        
        if not part_path:
            continue
        
        part_full_path = os.path.join(upload_dir, part_path)
        if not os.path.exists(part_full_path):
            print(f'[render_export] パーツ画像が見つかりません: {part_full_path}')
            continue
        
        # パーツ画像読み込み
        part_img = Image.open(part_full_path).convert('RGBA')
        
        # adjustment取得
        adjustment = state.get(part_key, {
            'dx': 0, 'dy': 0, 'scale': 1.0, 'rotate': 0, 'opacity': 1.0
        })
        
        # anchor取得
        anchor = anchors.get(part_key)
        if not anchor:
            print(f'[render_export] アンカーが見つかりません: {part_key}')
            continue
        
        # パーツ合成
        canvas = _composite_part_simple(canvas, part_img, anchor, adjustment)
    
    # PNG保存
    os.makedirs(os.path.dirname(output_png_path), exist_ok=True)
    canvas.save(output_png_path, 'PNG', optimize=True)
    
    print(f'[render_export] PNG生成完了: {output_png_path}')


def _normalize_state_format(state_raw):
    """
    state形式を統一
    
    Input: eyebrow.left/right 形式 or parts.leftBrow/rightBrow 形式
    Output: leftBrow/rightBrow/nose 形式
    """
    # 既にparts形式ならそのまま
    if 'leftBrow' in state_raw or 'rightBrow' in state_raw:
        return state_raw
    
    # eyebrow.left/right形式を変換
    normalized = {}
    
    eyebrow = state_raw.get('eyebrow', {})
    if 'left' in eyebrow:
        normalized['leftBrow'] = eyebrow['left']
    if 'right' in eyebrow:
        normalized['rightBrow'] = eyebrow['right']
    
    if 'nose' in state_raw:
        normalized['nose'] = state_raw['nose']
    
    return normalized


def _scale_anchors_simple(anchors, scale_factor):
    """アンカー座標をスケール調整（x,y形式対応）"""
    scaled = {}
    for key, anchor in anchors.items():
        if not anchor:
            continue
        
        # x,y形式とcx,cy形式の両方に対応
        x = anchor.get('x', anchor.get('cx', 0))
        y = anchor.get('y', anchor.get('cy', 0))
        w = anchor.get('w', 0)
        h = anchor.get('h', 0)
        
        scaled[key] = {
            'x': x * scale_factor,
            'y': y * scale_factor,
            'w': w * scale_factor,
            'h': h * scale_factor
        }
    return scaled


def _composite_part_simple(canvas, part_img, anchor, adjustment):
    """
    パーツ合成（シンプル版）
    
    Args:
        canvas: ベース画像
        part_img: パーツ画像（RGBA）
        anchor: {x, y, w, h} or {cx, cy, w, h}
        adjustment: {dx, dy, scale, rotate, opacity}
    """
    # アンカー座標（x,y形式とcx,cy形式の両方に対応）
    anchor_x = anchor.get('x', anchor.get('cx', 0))
    anchor_y = anchor.get('y', anchor.get('cy', 0))
    anchor_w = anchor.get('w', 0)
    anchor_h = anchor.get('h', 0)
    
    if anchor_w <= 0 or anchor_h <= 0:
        return canvas
    
    # スケール計算
    base_scale = anchor_w / part_img.width
    final_scale = base_scale * adjustment.get('scale', 1.0)
    
    new_width = int(part_img.width * final_scale)
    new_height = int(part_img.height * final_scale)
    
    if new_width <= 0 or new_height <= 0:
        return canvas
    
    # リサイズ
    resized = part_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # 回転（Step4-B最小実装ではスキップ可能だが、実装済みなので残す）
    rotate_deg = adjustment.get('rotate', 0)
    if rotate_deg != 0:
        resized = resized.rotate(-rotate_deg, expand=True, resample=Image.Resampling.BICUBIC)
    
    # 透明度調整
    opacity = adjustment.get('opacity', 1.0)
    if opacity < 1.0:
        alpha = resized.split()[3]
        alpha = alpha.point(lambda p: int(p * opacity))
        resized.putalpha(alpha)
    
    # 配置座標（アンカー中心 + 調整オフセット）
    dx = adjustment.get('dx', 0)
    dy = adjustment.get('dy', 0)
    final_x = int(anchor_x + dx)
    final_y = int(anchor_y + dy)
    
    # パーツの左上座標（中心配置）
    paste_x = final_x - resized.width // 2
    paste_y = final_y - resized.height // 2
    
    # 範囲外clamp
    paste_x = max(0, min(paste_x, canvas.width - resized.width))
    paste_y = max(0, min(paste_y, canvas.height - resized.height))
    
    # 合成
    try:
        canvas.paste(resized, (paste_x, paste_y), resized)
    except Exception as e:
        print(f'[_composite_part_simple] 合成エラー: {e}')
    
    return canvas
