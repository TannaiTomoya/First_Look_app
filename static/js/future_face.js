/**
 * Future Face - Phase1: Slim
 * 
 * 顔の輪郭を細く加工する機能
 * - 頬〜顎のみ対象（鼻・額は守る）
 * - x方向のみワープ（顔の幅を縮める）
 * - 局所ワープで自然な変形
 */

// 顎〜頬の外周ランドマークインデックス（鼻より下のみ）
const JAW_SLIM_IDX = [
    234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
    377, 400, 378, 379, 365, 397, 288, 361, 323, 454
];

/**
 * Future Face適用（MVP: Slimのみ）
 */
function applyFutureFaceMVP(imageData, canvas, landmarks, ff) {
    const preset = ff.preset || "all";
    const s = Math.max(0, Math.min(1, (ff.strength ?? 40) / 100));
    
    let out = imageData;
    
    if (preset === "slim" || preset === "all") {
        out = slimJaw(out, canvas, landmarks, s);
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
