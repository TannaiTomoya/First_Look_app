"""
Future Face Processor - サーバーサイド画像処理
MediaPipe + OpenCVでFuture Face効果を適用
"""

import base64
import io
import numpy as np
import cv2
from PIL import Image
import mediapipe as mp


class FutureFaceProcessor:
    """Future Face画像処理クラス"""
    
    def __init__(self):
        """MediaPipe Face Meshを初期化"""
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )
    
    def base64_to_image(self, base64_str):
        """Base64文字列をnumpy配列（BGR）に変換"""
        # data:image/png;base64, プレフィックスを削除
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        
        image_bytes = base64.b64decode(base64_str)
        image = Image.open(io.BytesIO(image_bytes))
        
        # RGBに変換
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # numpy配列に変換（BGR）
        img_array = np.array(image)
        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        
        return img_bgr
    
    def image_to_base64(self, img_bgr):
        """numpy配列（BGR）をBase64文字列に変換"""
        # BGRからRGBに変換
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        
        # PILイメージに変換
        pil_img = Image.fromarray(img_rgb)
        
        # Base64エンコード
        buffered = io.BytesIO()
        pil_img.save(buffered, format="PNG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        return f"data:image/png;base64,{img_base64}"
    
    def detect_landmarks(self, img_bgr):
        """顔のランドマークを検出"""
        height, width = img_bgr.shape[:2]
        
        # RGBに変換（MediaPipeはRGBを要求）
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        
        # 顔検出
        results = self.face_mesh.process(img_rgb)
        
        if not results.multi_face_landmarks:
            return None
        
        # 最初の顔のランドマークを取得
        face_landmarks = results.multi_face_landmarks[0]
        
        # 正規化座標をピクセル座標に変換
        landmarks = []
        for landmark in face_landmarks.landmark:
            x = int(landmark.x * width)
            y = int(landmark.y * height)
            landmarks.append((x, y))
        
        return landmarks
    
    def apply_slim_effect(self, img_bgr, landmarks, strength):
        """小顔効果（輪郭を細く）"""
        if landmarks is None or strength == 0:
            return img_bgr
        
        height, width = img_bgr.shape[:2]
        
        # 顎〜頬の外周ランドマークインデックス
        JAW_SLIM_IDX = [
            234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
            377, 400, 378, 379, 365, 397, 288, 361, 323, 454
        ]
        
        # ワープマップを作成
        map_x = np.zeros((height, width), dtype=np.float32)
        map_y = np.zeros((height, width), dtype=np.float32)
        
        for y in range(height):
            for x in range(width):
                map_x[y, x] = x
                map_y[y, x] = y
        
        # 各ランドマークで局所ワープ
        for idx in JAW_SLIM_IDX:
            if idx >= len(landmarks):
                continue
            
            lm_x, lm_y = landmarks[idx]
            
            # 顔の中心（鼻の付け根: landmark 168）
            center_x, center_y = landmarks[168] if len(landmarks) > 168 else (width // 2, height // 2)
            
            # 中心に向かって縮める
            dx = center_x - lm_x
            dy = center_y - lm_y
            
            # ワープの強度（strengthは0.0-1.0）
            shift = strength * 0.3  # 最大30%移動
            
            # ガウシアンブラーのような効果範囲
            radius = min(width, height) * 0.15
            
            for y in range(max(0, int(lm_y - radius)), min(height, int(lm_y + radius))):
                for x in range(max(0, int(lm_x - radius)), min(width, int(lm_x + radius))):
                    dist = np.sqrt((x - lm_x) ** 2 + (y - lm_y) ** 2)
                    if dist < radius:
                        weight = (1 - dist / radius) ** 2  # ガウシアン風
                        map_x[y, x] += dx * shift * weight
                        map_y[y, x] += dy * shift * weight
        
        # ワープ適用
        result = cv2.remap(img_bgr, map_x, map_y, cv2.INTER_LINEAR)
        
        return result
    
    def apply_skin_effect(self, img_bgr, landmarks, strength):
        """美肌効果（肌を明るく滑らかに）"""
        if landmarks is None or strength == 0:
            return img_bgr
        
        height, width = img_bgr.shape[:2]
        
        # 顔の輪郭マスクを作成
        mask = np.zeros((height, width), dtype=np.uint8)
        
        # 顔の輪郭ポリゴン
        FACE_OUTLINE_IDX = [
            10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
            397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
            172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
        ]
        
        face_points = [landmarks[i] for i in FACE_OUTLINE_IDX if i < len(landmarks)]
        face_points = np.array(face_points, dtype=np.int32)
        cv2.fillPoly(mask, [face_points], 255)
        
        # 目・口・鼻を除外
        exclude_indices = [
            # 左目
            33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
            # 右目
            263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466,
            # 口
            61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
            # 鼻孔
            98, 97, 2, 326, 327
        ]
        
        for indices in [exclude_indices]:
            exclude_points = [landmarks[i] for i in indices if i < len(landmarks)]
            if exclude_points:
                exclude_points = np.array(exclude_points, dtype=np.int32)
                cv2.fillPoly(mask, [exclude_points], 0)
        
        # マスクをぼかす（境界を自然に）
        mask = cv2.GaussianBlur(mask, (21, 21), 11)
        mask = mask.astype(np.float32) / 255.0
        
        # 元画像をぼかす（美肌効果）
        blurred = cv2.bilateralFilter(img_bgr, 9, 75, 75)
        
        # 明るさ調整
        hsv = cv2.cvtColor(blurred, cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * (1 + strength * 0.2), 0, 255)  # 明るさ +20%
        blurred = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
        
        # マスクで合成
        result = img_bgr.copy().astype(np.float32)
        for c in range(3):
            result[:, :, c] = (
                img_bgr[:, :, c] * (1 - mask * strength * 0.6) +
                blurred[:, :, c] * (mask * strength * 0.6)
            )
        
        return result.astype(np.uint8)
    
    def apply_young_effect(self, img_bgr, landmarks, strength):
        """若返り効果（ほうれい線軽減）"""
        if landmarks is None or strength == 0:
            return img_bgr
        
        # 簡易版: 顔全体に軽くぼかしをかける
        kernel_size = int(3 + strength * 4)
        if kernel_size % 2 == 0:
            kernel_size += 1
        
        blurred = cv2.GaussianBlur(img_bgr, (kernel_size, kernel_size), 0)
        
        # 元画像と合成
        alpha = strength * 0.3
        result = cv2.addWeighted(img_bgr, 1 - alpha, blurred, alpha, 0)
        
        return result
    
    def apply_future_face(self, base64_image, preset='all', strength=40):
        """
        Future Face効果を適用
        
        Args:
            base64_image: Base64エンコードされた画像
            preset: 'all', 'slim', 'skin', 'young'
            strength: 0-100の強度
        
        Returns:
            dict: {
                'ok': True/False,
                'result_image': Base64画像,
                'processing_time_ms': 処理時間,
                'error': エラーメッセージ（エラー時のみ）
            }
        """
        import time
        start_time = time.time()
        
        try:
            # Base64をnumpy配列に変換
            img_bgr = self.base64_to_image(base64_image)
            
            # ランドマーク検出
            landmarks = self.detect_landmarks(img_bgr)
            
            if landmarks is None:
                return {
                    'ok': False,
                    'error': '顔が検出できませんでした。正面を向いた顔写真を使用してください。'
                }
            
            # 強度を0.0-1.0に正規化
            strength_normalized = strength / 100.0
            
            # プリセットに応じて効果を適用
            result = img_bgr.copy()
            
            if preset == 'all' or preset == 'slim':
                result = self.apply_slim_effect(result, landmarks, strength_normalized)
            
            if preset == 'all' or preset == 'skin':
                result = self.apply_skin_effect(result, landmarks, strength_normalized)
            
            if preset == 'all' or preset == 'young':
                result = self.apply_young_effect(result, landmarks, strength_normalized)
            
            # Base64に変換
            result_base64 = self.image_to_base64(result)
            
            # 処理時間を計算
            processing_time = int((time.time() - start_time) * 1000)
            
            return {
                'ok': True,
                'result_image': result_base64,
                'processing_time_ms': processing_time
            }
        
        except Exception as e:
            return {
                'ok': False,
                'error': f'処理中にエラーが発生しました: {str(e)}'
            }
    
    def __del__(self):
        """リソースを解放"""
        if hasattr(self, 'face_mesh'):
            self.face_mesh.close()


# グローバルインスタンス（初期化コストを削減）
_processor_instance = None

def get_processor():
    """シングルトンパターンでプロセッサを取得"""
    global _processor_instance
    if _processor_instance is None:
        _processor_instance = FutureFaceProcessor()
    return _processor_instance
