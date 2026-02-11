/**
 * Future Face - Phase1: Slim / Phase2: Skin
 * 
 * Phase1 - Slim:
 * - 顔の輪郭を細く加工する機能
 * - 頬〜顎のみ対象（鼻・額は守る）
 * - x方向のみワープ（顔の幅を縮める）
 * 
 * Phase2 - Skin:
 * - 肌を明るく滑らかに加工する機能
 * - 目・眉・口・鼻孔は除外（溶けない）
 * - マスク境界をfeatherして自然な合成
 */

// 顎〜頬の外周ランドマークインデックス（鼻より下のみ）
const JAW_SLIM_IDX = [
    234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
    377, 400, 378, 379, 365, 397, 288, 361, 323, 454
];

// Phase2 - Skin: 顔の輪郭ポリゴン（目・眉・口・鼻孔を除外）
const FACE_OUTLINE_IDX = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

// 除外領域: 左目
const LEFT_EYE_IDX = [
    33, 7, 163, 144, 145, 153, 154, 155, 133,
    173, 157, 158, 159, 160, 161, 246
];

// 除外領域: 右目
const RIGHT_EYE_IDX = [
    263, 249, 390, 373, 374, 380, 381, 382, 362,
    398, 384, 385, 386, 387, 388, 466
];

// 除外領域: 口
const MOUTH_IDX = [
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
    291, 375, 321, 405, 314, 17, 84, 181, 91, 146
];

// 除外領域: 鼻孔
const NOSTRIL_IDX = [
    98, 97, 2, 326, 327
];

/**
 * Future Face適用（Phase1: Slim / Phase2: Skin）
 */
function applyFutureFaceMVP(imageData, canvas, landmarks, ff) {
    const preset = ff.preset || "all";
    const s = Math.max(0, Math.min(1, (ff.strength ?? 40) / 100));
    
    let out = imageData;
    
    if (preset === "slim" || preset === "all") {
        out = slimJaw(out, canvas, landmarks, s);
    }
    
    if (preset === "skin" || preset === "all") {
        out = skinEnhance(out, canvas, landmarks, s);
    }
    
    return out;
}

/**
 * 顎・頬を細くする（鼻を守る：x方向のみ）
 */
function slimJaw(imageData, canvas, landmarks, strength01) {
    const W = canvas.width, H = canvas.height;
    const amount = lerp(0.02, 0.06, strength01); // 2〜6%の収縮
    
    // 顔の中心x座標（左右の端点から計算）
    const cx = ((landmarks[234].x + landmarks[454].x) / 2) * W;
    const radius = Math.round(W * 0.08); // ワープ半径
    
    let out = imageData;
    
    for (const i of JAW_SLIM_IDX) {
        const p = landmarks[i];
        if (!p) continue;
        
        const x = p.x * W;
        const y = p.y * H;
        
        // 中心に向かって収縮
        const dx = (cx - x) * amount;
        
        out = localWarp(out, W, H, x, y, x + dx, y, radius);
    }
    
    return out;
}

/**
 * 局所ワープ（指定範囲のピクセルを移動）
 */
function localWarp(imageData, W, H, sx, sy, tx, ty, radius) {
    const src = imageData.data;
    const out = new Uint8ClampedArray(src);
    
    const r2 = radius * radius;
    const dx = tx - sx;
    const dy = ty - sy;
    
    const minX = Math.max(0, Math.floor(sx - radius));
    const maxX = Math.min(W - 1, Math.ceil(sx + radius));
    const minY = Math.max(0, Math.floor(sy - radius));
    const maxY = Math.min(H - 1, Math.ceil(sy + radius));
    
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const ddx = x - sx, ddy = y - sy;
            const d2 = ddx * ddx + ddy * ddy;
            if (d2 > r2) continue;
            
            // ガウシアンに近い重み（中心ほど強く変形）
            const w = 1 - (d2 / r2);
            
            const srcX = Math.round(x - dx * w);
            const srcY = Math.round(y - dy * w);
            if (srcX < 0 || srcX >= W || srcY < 0 || srcY >= H) continue;
            
            const si = (srcY * W + srcX) * 4;
            const di = (y * W + x) * 4;
            out[di]     = src[si];
            out[di + 1] = src[si + 1];
            out[di + 2] = src[si + 2];
            out[di + 3] = src[si + 3];
        }
    }
    
    return new ImageData(out, W, H);
}

/**
 * 線形補間
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// ========================================
// Phase2: Skin Enhancement
// ========================================

/**
 * 肌を明るく滑らかにする（目・眉・口・鼻孔は除外）
 */
function skinEnhance(imageData, canvas, landmarks, strength01) {
    const W = canvas.width, H = canvas.height;
    const data = imageData.data;
    
    // 1. 肌マスクを構築（0.0-1.0の範囲、feather付き）
    const mask = buildSkinMask(W, H, landmarks);
    
    // 2. ボックスブラー適用（軽量版スムージング）
    const blurred = boxBlur(imageData, W, H, 2); // radius=2
    
    // 3. 明るさ・彩度調整
    const adjusted = adjustTone(blurred, W, H, strength01);
    
    // 4. マスクを使って元画像とブレンド
    const out = new Uint8ClampedArray(data);
    const alpha = lerp(0.4, 0.6, strength01); // 40-60%の適用率
    
    for (let i = 0; i < data.length; i += 4) {
        const pixelIdx = i / 4;
        const m = mask[pixelIdx]; // マスク値（0.0-1.0）
        const blend = m * alpha;  // 実際の合成率
        
        out[i]     = data[i]     * (1 - blend) + adjusted.data[i]     * blend;
        out[i + 1] = data[i + 1] * (1 - blend) + adjusted.data[i + 1] * blend;
        out[i + 2] = data[i + 2] * (1 - blend) + adjusted.data[i + 2] * blend;
        out[i + 3] = data[i + 3]; // Alpha保持
    }
    
    return new ImageData(out, W, H);
}

/**
 * 肌マスク構築（顔のポリゴン塗りつぶし、目・口・鼻孔除外、境界feather）
 */
function buildSkinMask(W, H, landmarks) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    
    // 1. 顔の輪郭を塗りつぶし
    ctx.fillStyle = 'white';
    ctx.beginPath();
    for (let i = 0; i < FACE_OUTLINE_IDX.length; i++) {
        const p = landmarks[FACE_OUTLINE_IDX[i]];
        if (!p) continue;
        const x = p.x * W, y = p.y * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    
    // 2. 除外領域（目・口・鼻孔）を黒で塗りつぶし
    ctx.fillStyle = 'black';
    
    // 左目
    ctx.beginPath();
    for (let i = 0; i < LEFT_EYE_IDX.length; i++) {
        const p = landmarks[LEFT_EYE_IDX[i]];
        if (!p) continue;
        const x = p.x * W, y = p.y * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    
    // 右目
    ctx.beginPath();
    for (let i = 0; i < RIGHT_EYE_IDX.length; i++) {
        const p = landmarks[RIGHT_EYE_IDX[i]];
        if (!p) continue;
        const x = p.x * W, y = p.y * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    
    // 口
    ctx.beginPath();
    for (let i = 0; i < MOUTH_IDX.length; i++) {
        const p = landmarks[MOUTH_IDX[i]];
        if (!p) continue;
        const x = p.x * W, y = p.y * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    
    // 鼻孔（小さい円）
    ctx.fillStyle = 'black';
    for (const i of NOSTRIL_IDX) {
        const p = landmarks[i];
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, W * 0.015, 0, Math.PI * 2); // 半径1.5%
        ctx.fill();
    }
    
    // 3. マスクデータを取得して正規化（0-255 → 0.0-1.0）
    const imgData = ctx.getImageData(0, 0, W, H);
    const mask = new Float32Array(W * H);
    for (let i = 0; i < mask.length; i++) {
        mask[i] = imgData.data[i * 4] / 255.0; // R値を使用
    }
    
    // 4. マスク境界をfeather（簡易ガウシアンぼかし）
    return featherMask(mask, W, H, 8); // 8pxのfeather
}

/**
 * マスク境界をぼかす（簡易ボックスブラー）
 */
function featherMask(mask, W, H, radius) {
    const out = new Float32Array(mask.length);
    const r = Math.floor(radius);
    
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            let sum = 0, count = 0;
            
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                    sum += mask[ny * W + nx];
                    count++;
                }
            }
            
            out[y * W + x] = sum / count;
        }
    }
    
    return out;
}

/**
 * ボックスブラー（軽量版スムージング）
 */
function boxBlur(imageData, W, H, radius) {
    const data = imageData.data;
    const out = new Uint8ClampedArray(data);
    const r = Math.floor(radius);
    
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            let sumR = 0, sumG = 0, sumB = 0, count = 0;
            
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                    const i = (ny * W + nx) * 4;
                    sumR += data[i];
                    sumG += data[i + 1];
                    sumB += data[i + 2];
                    count++;
                }
            }
            
            const i = (y * W + x) * 4;
            out[i]     = sumR / count;
            out[i + 1] = sumG / count;
            out[i + 2] = sumB / count;
            out[i + 3] = data[i + 3]; // Alpha保持
        }
    }
    
    return new ImageData(out, W, H);
}

/**
 * 色調調整（明るさ・彩度UP）
 */
function adjustTone(imageData, W, H, strength01) {
    const data = imageData.data;
    const out = new Uint8ClampedArray(data);
    
    const gamma = lerp(1.0, 1.15, strength01);      // ガンマ補正（1.0-1.15）
    const saturation = lerp(1.0, 1.1, strength01);  // 彩度（1.0-1.1）
    
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i] / 255.0;
        let g = data[i + 1] / 255.0;
        let b = data[i + 2] / 255.0;
        
        // ガンマ補正（明るさUP）
        r = Math.pow(r, 1 / gamma);
        g = Math.pow(g, 1 / gamma);
        b = Math.pow(b, 1 / gamma);
        
        // 彩度調整（HSL変換なしの簡易版）
        const avg = (r + g + b) / 3;
        r = avg + (r - avg) * saturation;
        g = avg + (g - avg) * saturation;
        b = avg + (b - avg) * saturation;
        
        // クランプ
        out[i]     = Math.min(255, Math.max(0, r * 255));
        out[i + 1] = Math.min(255, Math.max(0, g * 255));
        out[i + 2] = Math.min(255, Math.max(0, b * 255));
        out[i + 3] = data[i + 3];
    }
    
    return new ImageData(out, W, H);
}
