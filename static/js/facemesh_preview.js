/**
 * MediaPipe FaceMesh プレビュー機能
 * Step1: ランドマーク追従によるパーツ配置
 * Step2: 左右別スライダー＋プリセット＋微調整UI
 * Step3: Undo/Redo＋Before/After比較＋保存導線
 * Step4: 高品質レンダリング確定版＋共有URL
 */

// ---- Step4 bridge state ----
const RenderState = {
    // 微調整（Step2のスライダー値）
    state: {
        eyebrow: {
            left:  { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 },
            right: { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 }
        },
        nose: { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 }
    },

    // FaceMeshから計算されたアンカー（pixel座標）を"最後の安定値"として保持
    anchors: {
        leftBrow:  null, // {x,y,w,h}
        rightBrow: null,
        nose:      null,
        meta: {
            canvasW: 0,
            canvasH: 0,
            ts: 0
        }
    },

    detection: {
        lastSeenAt: 0,
        lastGoodAnchorsAt: 0
    }
};

/**
 * アンカーのバリデーションと保持（Step4）
 */
function updateAnchorsIfValid(nextAnchors, canvasW, canvasH) {
    const now = Date.now();
    
    // ざっくりバリデーション（壊れ値を弾く）
    const isRectOk = (r) =>
        r && Number.isFinite(r.cx) && Number.isFinite(r.cy) && Number.isFinite(r.w) && Number.isFinite(r.h) &&
        r.w > 5 && r.h > 5 &&
        r.cx >= -50 && r.cy >= -50 && r.cx <= canvasW + 50 && r.cy <= canvasH + 50;
    
    const ok =
        isRectOk(nextAnchors.leftBrow) &&
        isRectOk(nextAnchors.rightBrow) &&
        isRectOk(nextAnchors.nose);
    
    RenderState.detection.lastSeenAt = now;
    
    if (ok) {
        // cx,cy形式をx,y形式に変換（サーバ用）
        RenderState.anchors.leftBrow = {
            x: nextAnchors.leftBrow.cx,
            y: nextAnchors.leftBrow.cy,
            w: nextAnchors.leftBrow.w,
            h: nextAnchors.leftBrow.h
        };
        RenderState.anchors.rightBrow = {
            x: nextAnchors.rightBrow.cx,
            y: nextAnchors.rightBrow.cy,
            w: nextAnchors.rightBrow.w,
            h: nextAnchors.rightBrow.h
        };
        RenderState.anchors.nose = {
            x: nextAnchors.nose.cx,
            y: nextAnchors.nose.cy,
            w: nextAnchors.nose.w,
            h: nextAnchors.nose.h
        };
        
        RenderState.anchors.meta.canvasW = canvasW;
        RenderState.anchors.meta.canvasH = canvasH;
        RenderState.anchors.meta.ts = now;
        RenderState.detection.lastGoodAnchorsAt = now;
    }
    
    return ok;
}

/**
 * Export用のpayloadを取得（Step4）
 */
function getExportPayload(templateId) {
    if (!templateId) {
        return { error: "template_idが取得できません" };
    }
    
    const a = RenderState.anchors;
    if (!a.leftBrow || !a.rightBrow || !a.nose) {
        return { error: "顔が検出できていません。顔が映る位置に調整してください。" };
    }
    
    return {
        template_id: templateId,
        state: RenderState.state,
        anchors: {
            leftBrow: a.leftBrow,
            rightBrow: a.rightBrow,
            nose: a.nose,
            meta: a.meta
        },
        format: "PNG"
    };
}

// プリセット定義（Step2）
const PRESETS = {
    clean: {
        leftBrow:  { dx: 0, dy: -6, scale: 1.02, rotate: 0, opacity: 0.85 },
        rightBrow: { dx: 0, dy: -6, scale: 1.02, rotate: 0, opacity: 0.85 },
        nose:      { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 }
    },
    smart: {
        leftBrow:  { dx: -2, dy: -3, scale: 1.05, rotate: -2, opacity: 0.95 },
        rightBrow: { dx: 2, dy: -3, scale: 1.05, rotate: 2, opacity: 0.95 },
        nose:      { dx: 0, dy: 0, scale: 0.98, rotate: 0, opacity: 1.0 }
    },
    gentle: {
        leftBrow:  { dx: 0, dy: 3, scale: 0.98, rotate: 2, opacity: 0.75 },
        rightBrow: { dx: 0, dy: 3, scale: 0.98, rotate: -2, opacity: 0.75 },
        nose:      { dx: 0, dy: 2, scale: 1.02, rotate: 0, opacity: 0.95 }
    }
};

class FaceMeshPreview {
    constructor(canvasId, baseImageId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.baseImage = document.getElementById(baseImageId);
        
        // FaceMesh関連
        this.faceMesh = null;
        this.isProcessing = false;
        this.lastProcessTime = 0;
        this.processInterval = 100; // 10FPS（間引き）
        
        // ランドマーク・アンカー
        this.currentAnchors = null;
        this.lastDetectionTime = 0;
        this.undetectedStartTime = null;
        this.undetectedTimeout = 3000; // 3秒
        
        // パーツ画像
        this.partsImages = {
            leftBrow: null,
            rightBrow: null,
            nose: null
        };
        
        // Step2: 調整データモデル（唯一の真実）
        this.state = {
            parts: {
                leftBrow:  { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 },
                rightBrow: { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 },
                nose:      { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 }
            },
            presetId: null,
            activePart: 'leftBrow' // 現在調整中のパーツ
        };
        
        // Step3: Undo/Redo履歴管理
        this.history = {
            past: [],
            future: [],
            limit: 50,
            isApplying: false
        };
        
        // Step3: Before/After比較モード
        this.compareMode = 'after'; // 'after' | 'before' | 'hold'
        
        // Step3: テンプレートID（保存用）
        this.templateId = null;
        
        // 後方互換用（Step1のpartState）
        this.partState = {
            eyebrow: { offsetX: 0, offsetY: 0, rotation: 0 },
            nose: { offsetX: 0, offsetY: 0, rotation: 0 }
        };
        
        // 選択中のパーツ情報
        this.selectedParts = {
            eyebrow: null,
            nose: null
        };
        
        // Throttle用タイマー
        this.renderThrottleTimer = null;
        this.saveStateTimer = null;
        
        // Debug mode
        this.debugMode = new URLSearchParams(window.location.search).get('debug') === '1';
        
        // 初期化状態
        this.initialized = false;
        this.fallbackMode = false;
        
        // localStorage key
        this.storageKey = 'firstlook.facemesh.adjustments.v1';
    }
    
    /**
     * FaceMesh初期化（壊れない設計）
     */
    async init() {
        const statusEl = document.getElementById('facemeshStatus');
        
        try {
            statusEl.style.display = 'block';
            statusEl.textContent = 'FaceMesh初期化中...';
            statusEl.className = 'alert alert-info';
            
            // MediaPipeが読み込まれているか確認
            if (typeof FaceMesh === 'undefined') {
                throw new Error('MediaPipe FaceMeshが読み込まれていません');
            }
            
            this.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                }
            });
            
            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            this.faceMesh.onResults(this.onResults.bind(this));
            
            statusEl.style.display = 'none';
            this.initialized = true;
            
            console.log('✓ FaceMesh初期化完了');
            return true;
            
        } catch (err) {
            console.error('FaceMesh初期化失敗:', err);
            this.enableFallback('FaceMesh初期化失敗: ' + err.message);
            return false;
        }
    }
    
    /**
     * 画像からランドマーク取得
     */
    async processImage() {
        const now = Date.now();
        
        // 間引き処理（パフォーマンス対策）
        if (now - this.lastProcessTime < this.processInterval) {
            return;
        }
        this.lastProcessTime = now;
        
        if (this.isProcessing || !this.faceMesh || this.fallbackMode) {
            return;
        }
        
        this.isProcessing = true;
        
        try {
            // 入力画像のリサイズ（パフォーマンス対策）
            const resized = this.resizeImage(this.baseImage, 640);
            await this.faceMesh.send({ image: resized });
            
        } catch (err) {
            console.error('FaceMesh処理エラー:', err);
            
            // 前回のアンカーで描画継続（破綻を防ぐ）
            if (this.currentAnchors) {
                this.renderComposite();
            }
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * FaceMesh結果処理（Step4: RenderStateへの保持追加）
     */
    onResults(results) {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            // 検出成功
            const landmarks = results.multiFaceLandmarks[0];
            const nextAnchors = this.computeAnchors(landmarks);
            
            // Step4: アンカーをバリデーションして保持
            const ok = updateAnchorsIfValid(nextAnchors, this.canvas.width, this.canvas.height);
            
            // Step4-A: window.__FL_ANCHORS__にも保持（最小パッチ用）
            if (ok) {
                window.__FL_ANCHORS__ = RenderState.anchors;
            }
            
            // 描画用：okならnextAnchors、ダメなら最後の保持値
            if (ok) {
                this.currentAnchors = nextAnchors;
            } else {
                // 保持値があればそれを使用
                if (RenderState.anchors.leftBrow && RenderState.anchors.rightBrow && RenderState.anchors.nose) {
                    this.currentAnchors = {
                        leftBrow: {
                            cx: RenderState.anchors.leftBrow.x,
                            cy: RenderState.anchors.leftBrow.y,
                            w: RenderState.anchors.leftBrow.w,
                            h: RenderState.anchors.leftBrow.h
                        },
                        rightBrow: {
                            cx: RenderState.anchors.rightBrow.x,
                            cy: RenderState.anchors.rightBrow.y,
                            w: RenderState.anchors.rightBrow.w,
                            h: RenderState.anchors.rightBrow.h
                        },
                        nose: {
                            cx: RenderState.anchors.nose.x,
                            cy: RenderState.anchors.nose.y,
                            w: RenderState.anchors.nose.w,
                            h: RenderState.anchors.nose.h
                        }
                    };
                }
            }
            
            this.lastDetectionTime = Date.now();
            this.undetectedStartTime = null;
            
            // ステータスを非表示
            const statusEl = document.getElementById('facemeshStatus');
            if (statusEl) {
                statusEl.style.display = 'none';
            }
            
            this.renderComposite();
            
        } else {
            // 未検出
            if (!this.undetectedStartTime) {
                this.undetectedStartTime = Date.now();
            }
            
            const undetectedDuration = Date.now() - this.undetectedStartTime;
            
            if (undetectedDuration > this.undetectedTimeout) {
                // 3秒以上未検出
                this.showGuidance('顔が映る位置に調整してください');
            }
            
            // 前回のアンカーで描画継続（ガタつき回避）
            if (this.currentAnchors) {
                this.renderComposite();
            }
        }
    }
    
    /**
     * アンカー計算（安定最優先）
     * MediaPipe FaceMeshランドマーク: 468点
     */
    computeAnchors(landmarks) {
        // MediaPipe FaceMeshのランドマーク番号
        // 眉: 左眉 70-79, 55-66 / 右眉 300-309, 285-295
        // 鼻: 鼻筋 1, 2 / 小鼻 98, 327
        
        // 左眉アンカー（複数点から矩形計算）
        const leftBrowIndices = [70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66];
        const leftBrowPoints = leftBrowIndices.map(i => landmarks[i]);
        const leftBrowBox = this.getBoundingBox(leftBrowPoints);
        
        // 右眉アンカー
        const rightBrowIndices = [300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 285, 286, 287, 288, 289, 290, 291, 292, 293, 294, 295, 296];
        const rightBrowPoints = rightBrowIndices.map(i => landmarks[i]);
        const rightBrowBox = this.getBoundingBox(rightBrowPoints);
        
        // 鼻アンカー
        const noseIndices = [1, 2, 4, 5, 6, 98, 327];
        const nosePoints = noseIndices.map(i => landmarks[i]);
        const noseBox = this.getBoundingBox(nosePoints);
        
        // 顔サイズを計算（左右の顔の端点）
        const faceWidth = Math.abs(landmarks[454].x - landmarks[234].x);
        const scaleFactor = faceWidth * 5; // Canvas座標に変換
        
        return {
            leftBrow: this.ensureMinSize(leftBrowBox, scaleFactor),
            rightBrow: this.ensureMinSize(rightBrowBox, scaleFactor),
            nose: this.ensureMinSize(noseBox, scaleFactor)
        };
    }
    
    /**
     * 複数点から矩形を計算
     */
    getBoundingBox(points) {
        const xs = points.map(p => p.x * this.canvas.width);
        const ys = points.map(p => p.y * this.canvas.height);
        
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        return {
            cx: (minX + maxX) / 2,
            cy: (minY + maxY) / 2,
            w: maxX - minX,
            h: maxY - minY
        };
    }
    
    /**
     * 矩形の最小サイズを確保（小さすぎる矩形を防ぐ）
     */
    ensureMinSize(box, scaleFactor) {
        const minW = 30 * (scaleFactor / 100);
        const minH = 20 * (scaleFactor / 100);
        
        return {
            cx: box.cx,
            cy: box.cy,
            w: Math.max(box.w, minW),
            h: Math.max(box.h, minH)
        };
    }
    
    /**
     * Canvas合成描画（Step3: compareMode対応）
     */
    renderComposite() {
        // Canvas状態リセット
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.globalAlpha = 1.0;
        
        // 1. ベース画像
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.baseImage, 0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.currentAnchors) {
            return; // アンカーがない場合は描画しない
        }
        
        // Step3: compareModeを考慮して有効なstateを取得
        const effectiveState = this.getEffectiveState();
        const finalAnchors = {}; // Debug用
        
        // 2. 右眉
        if (this.partsImages.rightBrow && this.selectedParts.eyebrow) {
            const anchor = this.currentAnchors.rightBrow;
            const adjustment = effectiveState.parts.rightBrow;
            
            finalAnchors.rightBrow = this.drawPartWithAdjustment(
                this.partsImages.rightBrow,
                anchor,
                adjustment,
                { compositeOp: 'source-over' }
            );
        }
        
        // 3. 左眉
        if (this.partsImages.leftBrow && this.selectedParts.eyebrow) {
            const anchor = this.currentAnchors.leftBrow;
            const adjustment = effectiveState.parts.leftBrow;
            
            finalAnchors.leftBrow = this.drawPartWithAdjustment(
                this.partsImages.leftBrow,
                anchor,
                adjustment,
                { compositeOp: 'source-over' }
            );
        }
        
        // 4. 鼻
        if (this.partsImages.nose && this.selectedParts.nose) {
            const anchor = this.currentAnchors.nose;
            const adjustment = effectiveState.parts.nose;
            
            finalAnchors.nose = this.drawPartWithAdjustment(
                this.partsImages.nose,
                anchor,
                adjustment,
                { compositeOp: 'soft-light' }
            );
        }
        
        // Canvas状態を再度リセット
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.globalAlpha = 1.0;
        
        // Debug表示
        if (this.debugMode) {
            this.drawDebugAnchors(finalAnchors, effectiveState);
        }
    }
    
    /**
     * パーツ描画（Step2: adjustment適用）
     */
    drawPartWithAdjustment(img, anchor, adjustment, options = {}) {
        const { compositeOp = 'source-over' } = options;
        
        // anchorsに adjustmentを加算して最終位置を計算
        const finalCx = anchor.cx + adjustment.dx;
        const finalCy = anchor.cy + adjustment.dy;
        const finalW = anchor.w * adjustment.scale;
        const finalH = anchor.h * adjustment.scale;
        const finalRotate = adjustment.rotate;
        const finalOpacity = adjustment.opacity;
        
        this.ctx.save();
        this.ctx.globalCompositeOperation = compositeOp;
        this.ctx.globalAlpha = finalOpacity;
        
        // 画像サイズ計算（アンカー幅に合わせる）
        const baseScale = finalW / img.width;
        const w = img.width * baseScale;
        const h = img.height * baseScale;
        
        // 回転
        this.ctx.translate(finalCx, finalCy);
        this.ctx.rotate(finalRotate * Math.PI / 180);
        this.ctx.drawImage(img, -w / 2, -h / 2, w, h);
        
        this.ctx.restore();
        
        // Debug用に最終アンカーを返す
        return { cx: finalCx, cy: finalCy, w: finalW, h: finalH, rotate: finalRotate };
    }
    
    /**
     * Debug: アンカー矩形を可視化（Step3: compareMode, 履歴も表示）
     */
    drawDebugAnchors(finalAnchors = {}, effectiveState = null) {
        if (!this.currentAnchors) return;
        
        const state = effectiveState || this.state;
        
        this.ctx.save();
        this.ctx.font = '11px monospace';
        
        // 元のアンカー（緑色・細線）
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([]);
        
        ['leftBrow', 'rightBrow', 'nose'].forEach(key => {
            const anchor = this.currentAnchors[key];
            
            // 矩形
            this.ctx.strokeRect(
                anchor.cx - anchor.w / 2,
                anchor.cy - anchor.h / 2,
                anchor.w,
                anchor.h
            );
            
            // ラベル
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillText(
                `${key} (base)`,
                anchor.cx - anchor.w / 2,
                anchor.cy - anchor.h / 2 - 18
            );
        });
        
        // 調整後のアンカー（黄色・点線）
        if (Object.keys(finalAnchors).length > 0) {
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            
            for (const key in finalAnchors) {
                const final = finalAnchors[key];
                
                // 矩形
                this.ctx.strokeRect(
                    final.cx - final.w / 2,
                    final.cy - final.h / 2,
                    final.w,
                    final.h
                );
                
                // ラベル
                this.ctx.fillStyle = '#ffff00';
                const adj = state.parts[key];
                this.ctx.fillText(
                    `${key} (dx:${adj.dx},dy:${adj.dy},s:${adj.scale.toFixed(2)},r:${adj.rotate})`,
                    final.cx - final.w / 2,
                    final.cy - final.h / 2 - 5
                );
            }
        }
        
        // FPS表示
        this.ctx.fillStyle = '#00ff00';
        this.ctx.fillText(`FPS: ${Math.round(1000 / this.processInterval)} (間引き設定)`, 10, 20);
        
        // Step3: 履歴・比較モード表示
        this.ctx.fillText(`History: past=${this.history.past.length}, future=${this.history.future.length}`, 10, 35);
        this.ctx.fillText(`CompareMode: ${this.compareMode}`, 10, 50);
        
        // State表示
        const activePart = state.activePart;
        const adj = state.parts[activePart];
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`Active: ${activePart}`, 10, 65);
        this.ctx.fillText(`dx:${adj.dx} dy:${adj.dy} s:${adj.scale.toFixed(2)} r:${adj.rotate}° o:${adj.opacity.toFixed(2)}`, 10, 80);
        
        this.ctx.restore();
    }
    
    /**
     * 画像リサイズ（パフォーマンス対策）
     */
    resizeImage(img, maxSize = 640) {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas;
    }
    
    /**
     * フォールバック有効化（白画面禁止）
     */
    enableFallback(reason) {
        console.warn('フォールバック有効化:', reason);
        this.fallbackMode = true;
        
        const statusEl = document.getElementById('facemeshStatus');
        if (statusEl) {
            statusEl.textContent = `顔認識が利用できません: ${reason}`;
            statusEl.className = 'alert alert-warning';
            statusEl.style.display = 'block';
        }
        
        // 既存の手動調整UIを表示（互換性維持）
        const adjustEl = document.getElementById('positionAdjust');
        if (adjustEl) {
            adjustEl.style.display = 'block';
        }
    }
    
    /**
     * ガイダンス表示
     */
    showGuidance(message) {
        const statusEl = document.getElementById('facemeshStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = 'alert alert-warning';
            statusEl.style.display = 'block';
        }
    }
    
    /**
     * パーツ選択（既存UIとの統合）
     */
    selectPart(partType, partData, imgElement) {
        this.selectedParts[partType] = partData;
        
        // Step2: 左右別に管理
        if (partType === 'eyebrow') {
            // 眉は左右に複製
            this.partsImages.leftBrow = imgElement;
            this.partsImages.rightBrow = imgElement;
        } else {
            this.partsImages[partType] = imgElement;
        }
        
        // 描画
        if (this.currentAnchors) {
            this.renderComposite();
        }
    }
    
    /**
     * パーツ状態更新（位置・回転調整・Step1互換用）
     */
    updatePartState(partType, updates) {
        Object.assign(this.partState[partType], updates);
        
        // Step2のstateと同期（既存UIとの互換性）
        if (partType === 'eyebrow') {
            // 眉の場合は左右両方に適用
            if (updates.offsetX !== undefined) {
                this.state.parts.leftBrow.dx = updates.offsetX;
                this.state.parts.rightBrow.dx = updates.offsetX;
            }
            if (updates.offsetY !== undefined) {
                this.state.parts.leftBrow.dy = updates.offsetY;
                this.state.parts.rightBrow.dy = updates.offsetY;
            }
            if (updates.rotation !== undefined) {
                this.state.parts.leftBrow.rotate = updates.rotation;
                this.state.parts.rightBrow.rotate = updates.rotation;
            }
        } else if (partType === 'nose' && this.state.parts.nose) {
            if (updates.offsetX !== undefined) {
                this.state.parts.nose.dx = updates.offsetX;
            }
            if (updates.offsetY !== undefined) {
                this.state.parts.nose.dy = updates.offsetY;
            }
            if (updates.rotation !== undefined) {
                this.state.parts.nose.rotate = updates.rotation;
            }
        }
        
        // 再描画
        if (this.currentAnchors) {
            this.renderComposite();
        }
        
        this.scheduleSaveState();
    }
    
    /**
     * パーツリセット（Step1互換用 - 削除とは別）
     * ※Step2では各パーツごとにresetPartが定義されているため注意
     */
    resetPartLegacy(partType) {
        this.partState[partType] = { offsetX: 0, offsetY: 0, rotation: 0 };
        
        // Step2のstateと同期
        if (partType === 'eyebrow') {
            this.state.parts.leftBrow = { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 };
            this.state.parts.rightBrow = { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 };
        } else if (partType === 'nose' && this.state.parts.nose) {
            this.state.parts.nose = { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 };
        }
        
        this.updateUIFromState();
        
        // 再描画
        if (this.currentAnchors) {
            this.renderComposite();
        }
        
        this.scheduleSaveState();
    }
    
    /**
     * パーツ削除
     */
    removePart(partType) {
        this.selectedParts[partType] = null;
        
        // Step2: 左右別に削除
        if (partType === 'eyebrow') {
            this.partsImages.leftBrow = null;
            this.partsImages.rightBrow = null;
            
            // 左右の調整をリセット
            this.state.parts.leftBrow = { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 };
            this.state.parts.rightBrow = { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 };
        } else {
            this.partsImages[partType] = null;
            
            // 調整をリセット
            if (this.state.parts[partType]) {
                this.state.parts[partType] = { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 };
            }
        }
        
        // Step1互換
        if (this.partState[partType]) {
            this.partState[partType] = { offsetX: 0, offsetY: 0, rotation: 0 };
        }
        
        this.updateUIFromState();
        this.scheduleSaveState();
        
        // 再描画
        if (this.currentAnchors) {
            this.renderComposite();
        } else {
            // アンカーがない場合はベース画像のみ描画
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(this.baseImage, 0, 0, this.canvas.width, this.canvas.height);
        }
    }

    // ========================================
    // Step2: State管理・永続化
    // ========================================
    
    /**
     * 状態を更新（Step3: Undo/Redo用に集約・履歴管理）
     */
    applyPatch(partKey, patch, meta = {}) {
        if (!this.state.parts[partKey]) {
            console.warn('無効なpartKey:', partKey);
            return;
        }
        
        // 履歴適用中はスタックに追加しない
        if (!this.history.isApplying) {
            // 現在のstateをdeep copyしてpastへ
            const snapshot = JSON.parse(JSON.stringify(this.state));
            this.history.past.push(snapshot);
            
            // past数制限
            if (this.history.past.length > this.history.limit) {
                this.history.past.shift();
            }
            
            // 新操作でredoを破棄
            this.history.future = [];
            
            // Undo/Redoボタンの状態更新
            this.updateUndoRedoButtons();
        }
        
        Object.assign(this.state.parts[partKey], patch);
        
        // Step4-A: window.__FL_STATE__にも同期
        this.syncToWindowState();
        
        this.scheduleRender();
        this.scheduleSaveState();
    }
    
    /**
     * Step4-A: window.__FL_STATE__に同期（最小パッチ用）
     */
    syncToWindowState() {
        window.__FL_STATE__ = {
            eyebrow: {
                left: {
                    dx: this.state.parts.leftBrow.dx,
                    dy: this.state.parts.leftBrow.dy,
                    scale: this.state.parts.leftBrow.scale,
                    rotate: this.state.parts.leftBrow.rotate,
                    opacity: this.state.parts.leftBrow.opacity
                },
                right: {
                    dx: this.state.parts.rightBrow.dx,
                    dy: this.state.parts.rightBrow.dy,
                    scale: this.state.parts.rightBrow.scale,
                    rotate: this.state.parts.rightBrow.rotate,
                    opacity: this.state.parts.rightBrow.opacity
                }
            },
            nose: {
                dx: this.state.parts.nose.dx,
                dy: this.state.parts.nose.dy,
                scale: this.state.parts.nose.scale,
                rotate: this.state.parts.nose.rotate,
                opacity: this.state.parts.nose.opacity
            }
        };
    }
    
    /**
     * アクティブパーツを切り替え
     */
    setActivePart(partKey) {
        if (!this.state.parts[partKey]) {
            console.warn('無効なpartKey:', partKey);
            return;
        }
        
        this.state.activePart = partKey;
        this.updateUIFromState();
    }
    
    /**
     * プリセット適用
     */
    applyPreset(presetId) {
        if (!PRESETS[presetId]) {
            console.warn('無効なpresetId:', presetId);
            return;
        }
        
        console.log(`プリセット適用: ${presetId}`);
        this.state.presetId = presetId;
        
        // プリセットを上書き
        const preset = PRESETS[presetId];
        for (const partKey in preset) {
            if (this.state.parts[partKey]) {
                Object.assign(this.state.parts[partKey], preset[partKey]);
            }
        }
        
        this.updateUIFromState();
        this.syncToWindowState(); // Step4-A
        this.scheduleRender();
        this.scheduleSaveState();
    }
    
    /**
     * パーツをリセット（対象のみ）
     */
    resetPart(partKey) {
        if (!this.state.parts[partKey]) {
            console.warn('無効なpartKey:', partKey);
            return;
        }
        
        this.state.parts[partKey] = { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 };
        this.updateUIFromState();
        this.syncToWindowState(); // Step4-A
        this.scheduleRender();
        this.scheduleSaveState();
    }
    
    /**
     * 全リセット
     */
    resetAll() {
        this.state = {
            parts: {
                leftBrow:  { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 },
                rightBrow: { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 },
                nose:      { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 }
            },
            presetId: null,
            activePart: this.state.activePart
        };
        
        // Step3: 履歴もクリア
        this.history.past = [];
        this.history.future = [];
        this.updateUndoRedoButtons();
        
        // localStorage削除
        localStorage.removeItem(this.storageKey);
        
        this.updateUIFromState();
        this.syncToWindowState(); // Step4-A
        this.scheduleRender();
        
        console.log('✓ 全リセット完了');
    }
    
    // ========================================
    // Step3: Undo/Redo機能
    // ========================================
    
    /**
     * Undo（元に戻す）
     */
    undo() {
        if (this.history.past.length === 0) {
            console.log('Undo: 履歴なし');
            return;
        }
        
        // 現在のstateをfutureへ
        const currentState = JSON.parse(JSON.stringify(this.state));
        this.history.future.push(currentState);
        
        // pastから復元
        const previousState = this.history.past.pop();
        
        this.history.isApplying = true;
        this.state = previousState;
        this.history.isApplying = false;
        
        this.updateUIFromState();
        this.syncToWindowState(); // Step4-A
        this.scheduleRender();
        this.updateUndoRedoButtons();
        this.scheduleSaveState();
        
        console.log('✓ Undo実行', { pastLength: this.history.past.length, futureLength: this.history.future.length });
    }
    
    /**
     * Redo（やり直す）
     */
    redo() {
        if (this.history.future.length === 0) {
            console.log('Redo: 履歴なし');
            return;
        }
        
        // 現在のstateをpastへ
        const currentState = JSON.parse(JSON.stringify(this.state));
        this.history.past.push(currentState);
        
        // futureから復元
        const nextState = this.history.future.pop();
        
        this.history.isApplying = true;
        this.state = nextState;
        this.history.isApplying = false;
        
        this.updateUIFromState();
        this.syncToWindowState(); // Step4-A
        this.scheduleRender();
        this.updateUndoRedoButtons();
        this.scheduleSaveState();
        
        console.log('✓ Redo実行', { pastLength: this.history.past.length, futureLength: this.history.future.length });
    }
    
    /**
     * Undo/Redoボタンの状態更新
     */
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) {
            undoBtn.disabled = this.history.past.length === 0;
        }
        
        if (redoBtn) {
            redoBtn.disabled = this.history.future.length === 0;
        }
    }
    
    // ========================================
    // Step3: Before/After比較機能
    // ========================================
    
    /**
     * 比較モードを設定
     */
    setCompareMode(mode) {
        this.compareMode = mode;
        this.scheduleRender();
        
        // ボタンのアクティブ状態更新
        const beforeBtn = document.getElementById('compare-before-btn');
        const afterBtn = document.getElementById('compare-after-btn');
        
        if (beforeBtn) {
            beforeBtn.classList.toggle('active', mode === 'before');
        }
        if (afterBtn) {
            afterBtn.classList.toggle('active', mode === 'after');
        }
    }
    
    /**
     * 有効なstateを取得（compareMode考慮）
     */
    getEffectiveState() {
        if (this.compareMode === 'before') {
            // Before: 微調整をOFFにした初期状態
            return {
                parts: {
                    leftBrow:  { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 },
                    rightBrow: { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 },
                    nose:      { dx: 0, dy: 0, scale: 1.0, rotate: 0, opacity: 1.0 }
                },
                presetId: null,
                activePart: this.state.activePart
            };
        }
        
        // After: 通常の state
        return this.state;
    }
    
    // ========================================
    // Step3: DB保存・復元機能
    // ========================================
    
    /**
     * stateをAPIに保存
     */
    async saveToAPI() {
        if (!this.templateId) {
            console.warn('templateIdが設定されていません');
            return false;
        }
        
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
            
            const response = await fetch('/api/face-template/adjustments/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    template_id: this.templateId,
                    state: this.state
                })
            });
            
            const data = await response.json();
            
            if (data.ok) {
                console.log('✓ API保存成功');
                
                // localStorageも同期
                this.saveState();
                
                return true;
            } else {
                console.error('API保存失敗:', data.error);
                return false;
            }
        } catch (err) {
            console.error('API保存エラー:', err);
            return false;
        }
    }
    
    /**
     * stateをAPIから復元
     */
    async loadFromAPI() {
        if (!this.templateId) {
            console.warn('templateIdが設定されていません');
            return false;
        }
        
        try {
            const response = await fetch(`/api/face-template/adjustments/?template_id=${this.templateId}`);
            const data = await response.json();
            
            if (data.ok && data.state) {
                console.log('✓ API復元成功');
                
                // stateをマージ
                if (data.state.parts) {
                    for (const partKey in data.state.parts) {
                        if (this.state.parts[partKey]) {
                            Object.assign(this.state.parts[partKey], data.state.parts[partKey]);
                        }
                    }
                }
                
                if (data.state.presetId) {
                    this.state.presetId = data.state.presetId;
                }
                
                if (data.state.activePart) {
                    this.state.activePart = data.state.activePart;
                }
                
                // localStorageも同期
                this.saveState();
                
                return true;
            } else if (data.ok && !data.state) {
                console.log('API: 保存データなし');
                return false;
            } else {
                console.error('API復元失敗:', data.error);
                return false;
            }
        } catch (err) {
            console.error('API復元エラー:', err);
            return false;
        }
    }
    
    /**
     * Step3: 初期化時の読み込み優先順位
     * 1. API優先
     * 2. localStorage
     * 3. 初期値
     */
    async loadStateWithPriority() {
        // 1. APIから復元を試みる
        const apiLoaded = await this.loadFromAPI();
        
        if (apiLoaded) {
            console.log('✓ APIから復元しました');
            return true;
        }
        
        // 2. localStorageから復元
        const localLoaded = this.loadState();
        
        if (localLoaded) {
            console.log('✓ localStorageから復元しました');
            return true;
        }
        
        // 3. 初期値（何もしない）
        console.log('✓ 初期値を使用します');
        return false;
    }
    
    // ========================================
    // Step4: 高品質エクスポート機能
    // ========================================
    
    /**
     * 高品質レンダリングをエクスポート（Step4: RenderState使用）
     */
    async exportHighQuality() {
        if (!this.templateId) {
            console.warn('templateIdが設定されていません');
            return { ok: false, error: 'templateIdが設定されていません' };
        }
        
        // Step4: RenderStateから最後の安定アンカーを取得
        const a = RenderState.anchors;
        if (!a.leftBrow || !a.rightBrow || !a.nose) {
            return { ok: false, error: '顔が検出できていません。顔が映る位置に調整してください。' };
        }
        
        // 選択されたパーツIDを取得
        const selectedPartIds = {
            eyebrow_id: this.selectedParts.eyebrow ? this.selectedParts.eyebrow.id : null,
            nose_id: this.selectedParts.nose ? this.selectedParts.nose.id : null
        };
        
        if (!selectedPartIds.eyebrow_id && !selectedPartIds.nose_id) {
            return { ok: false, error: '眉または鼻を選択してください' };
        }
        
        // Step4: RenderStateのstateを同期
        this.syncToRenderState();
        
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
            
            const response = await fetch('/api/face-template/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    template_id: this.templateId,
                    state: RenderState.state,
                    anchors: {
                        leftBrow: a.leftBrow,
                        rightBrow: a.rightBrow,
                        nose: a.nose,
                        meta: a.meta
                    },
                    parts: selectedPartIds,
                    format: 'PNG'
                })
            });
            
            const data = await response.json().catch(() => null);
            
            if (!response.ok || !data || !data.ok) {
                const msg = (data && (data.error || data.message)) || `export失敗 (${response.status})`;
                console.error('エクスポート失敗:', msg);
                return { ok: false, error: msg };
            }
            
            console.log('✓ エクスポート成功:', data);
            return data;
            
        } catch (err) {
            console.error('エクスポートエラー:', err);
            return { ok: false, error: `通信エラー: ${err.message}` };
        }
    }
    
    /**
     * Step4: this.stateをRenderStateに同期
     */
    syncToRenderState() {
        // Step2のstate構造をStep4のRenderState形式に変換
        RenderState.state.eyebrow.left = {
            dx: this.state.parts.leftBrow.dx,
            dy: this.state.parts.leftBrow.dy,
            scale: this.state.parts.leftBrow.scale,
            rotate: this.state.parts.leftBrow.rotate,
            opacity: this.state.parts.leftBrow.opacity
        };
        
        RenderState.state.eyebrow.right = {
            dx: this.state.parts.rightBrow.dx,
            dy: this.state.parts.rightBrow.dy,
            scale: this.state.parts.rightBrow.scale,
            rotate: this.state.parts.rightBrow.rotate,
            opacity: this.state.parts.rightBrow.opacity
        };
        
        RenderState.state.nose = {
            dx: this.state.parts.nose.dx,
            dy: this.state.parts.nose.dy,
            scale: this.state.parts.nose.scale,
            rotate: this.state.parts.nose.rotate,
            opacity: this.state.parts.nose.opacity
        };
    }
    
    /**
     * 描画をスケジュール（throttle）
     */
    scheduleRender() {
        if (this.renderThrottleTimer) return;
        
        this.renderThrottleTimer = setTimeout(() => {
            this.renderThrottleTimer = null;
            if (this.currentAnchors) {
                this.renderComposite();
            }
        }, 16); // 60FPS相当
    }
    
    /**
     * 状態保存をスケジュール（throttle）
     */
    scheduleSaveState() {
        if (this.saveStateTimer) {
            clearTimeout(this.saveStateTimer);
        }
        
        this.saveStateTimer = setTimeout(() => {
            this.saveState();
        }, 500);
    }
    
    /**
     * 状態をlocalStorageに保存
     */
    saveState() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (err) {
            console.warn('localStorage保存失敗:', err);
        }
    }
    
    /**
     * 状態をlocalStorageから復元
     */
    loadState() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                
                // マージ（新しいパーツが増えた場合に対応）
                if (parsed.parts) {
                    for (const partKey in parsed.parts) {
                        if (this.state.parts[partKey]) {
                            Object.assign(this.state.parts[partKey], parsed.parts[partKey]);
                        }
                    }
                }
                
                if (parsed.presetId) {
                    this.state.presetId = parsed.presetId;
                }
                
                if (parsed.activePart) {
                    this.state.activePart = parsed.activePart;
                }
                
                console.log('✓ 状態を復元しました');
                return true;
            }
        } catch (err) {
            console.warn('localStorage復元失敗:', err);
        }
        return false;
    }
    
    /**
     * UIを状態から更新
     */
    updateUIFromState() {
        const activePart = this.state.activePart;
        const part = this.state.parts[activePart];
        
        if (!part) return;
        
        // スライダー更新
        this.setSliderValue('dx', part.dx);
        this.setSliderValue('dy', part.dy);
        this.setSliderValue('scale', part.scale);
        this.setSliderValue('rotate', part.rotate);
        this.setSliderValue('opacity', part.opacity);
        
        // 数値表示更新
        this.setDisplayValue('dx', part.dx);
        this.setDisplayValue('dy', part.dy);
        this.setDisplayValue('scale', part.scale.toFixed(2));
        this.setDisplayValue('rotate', part.rotate);
        this.setDisplayValue('opacity', part.opacity.toFixed(2));
        
        // タブの表示更新
        this.updateTabUI();
    }
    
    /**
     * スライダー値を設定
     */
    setSliderValue(key, value) {
        const el = document.getElementById(`adjust-${key}`);
        if (el) el.value = value;
    }
    
    /**
     * 表示値を設定
     */
    setDisplayValue(key, value) {
        const el = document.getElementById(`display-${key}`);
        if (el) el.textContent = value;
    }
    
    /**
     * タブUI更新
     */
    updateTabUI() {
        const tabs = ['leftBrow', 'rightBrow', 'nose'];
        tabs.forEach(partKey => {
            const tab = document.getElementById(`tab-${partKey}`);
            if (tab) {
                tab.classList.toggle('active', partKey === this.state.activePart);
            }
        });
    }
    
    /**
     * UIイベントをバインド（Step3: Undo/Redo/Before/After/保存追加）
     */
    bindControls() {
        // タブ切り替え
        const tabs = ['leftBrow', 'rightBrow', 'nose'];
        tabs.forEach(partKey => {
            const tab = document.getElementById(`tab-${partKey}`);
            if (tab) {
                tab.addEventListener('click', () => this.setActivePart(partKey));
            }
        });
        
        // スライダー
        const sliders = ['dx', 'dy', 'scale', 'rotate', 'opacity'];
        sliders.forEach(key => {
            const slider = document.getElementById(`adjust-${key}`);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    this.applyPatch(this.state.activePart, { [key]: value });
                    this.setDisplayValue(key, key === 'scale' || key === 'opacity' ? value.toFixed(2) : value);
                });
            }
        });
        
        // プリセット
        const presetSelect = document.getElementById('preset-select');
        if (presetSelect) {
            presetSelect.addEventListener('change', (e) => {
                const presetId = e.target.value;
                if (presetId && presetId !== 'none') {
                    this.applyPreset(presetId);
                }
            });
        }
        
        // リセットボタン
        const resetBtn = document.getElementById('reset-part-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm(`${this.state.activePart}をリセットしますか？`)) {
                    this.resetPart(this.state.activePart);
                }
            });
        }
        
        const resetAllBtn = document.getElementById('reset-all-btn');
        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', () => {
                if (confirm('全ての調整をリセットしますか？')) {
                    this.resetAll();
                }
            });
        }
        
        // Step3: Undo/Redoボタン
        const undoBtn = document.getElementById('undo-btn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undo());
        }
        
        const redoBtn = document.getElementById('redo-btn');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.redo());
        }
        
        // Step3: Before/Afterボタン
        const beforeBtn = document.getElementById('compare-before-btn');
        if (beforeBtn) {
            beforeBtn.addEventListener('click', () => this.setCompareMode('before'));
        }
        
        const afterBtn = document.getElementById('compare-after-btn');
        if (afterBtn) {
            afterBtn.addEventListener('click', () => this.setCompareMode('after'));
        }
        
        // Step3: "押してる間だけBefore"ボタン
        const holdBtn = document.getElementById('compare-hold-btn');
        if (holdBtn) {
            holdBtn.addEventListener('mousedown', () => {
                this.setCompareMode('before');
            });
            holdBtn.addEventListener('mouseup', () => {
                this.setCompareMode('after');
            });
            holdBtn.addEventListener('mouseleave', () => {
                this.setCompareMode('after');
            });
            
            // タッチ対応
            holdBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.setCompareMode('before');
            });
            holdBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.setCompareMode('after');
            });
        }
        
        // Step3: 保存ボタン
        const saveBtn = document.getElementById('save-adjustment-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>保存中...';
                
                const success = await this.saveToAPI();
                
                if (success) {
                    // 成功表示
                    saveBtn.innerHTML = '<i class="fas fa-check me-1"></i>保存完了';
                    saveBtn.classList.remove('btn-primary');
                    saveBtn.classList.add('btn-success');
                    
                    setTimeout(() => {
                        saveBtn.innerHTML = '<i class="fas fa-save me-1"></i>保存';
                        saveBtn.classList.remove('btn-success');
                        saveBtn.classList.add('btn-primary');
                        saveBtn.disabled = false;
                    }, 2000);
                } else {
                    // エラー表示
                    saveBtn.innerHTML = '<i class="fas fa-times me-1"></i>保存失敗';
                    saveBtn.classList.remove('btn-primary');
                    saveBtn.classList.add('btn-danger');
                    
                    setTimeout(() => {
                        saveBtn.innerHTML = '<i class="fas fa-save me-1"></i>保存';
                        saveBtn.classList.remove('btn-danger');
                        saveBtn.classList.add('btn-primary');
                        saveBtn.disabled = false;
                    }, 2000);
                }
            });
        }
        
        // Step3: キーボードショートカット
        document.addEventListener('keydown', (e) => {
            // テキスト入力中は抑制
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // Cmd/Ctrl + Z: Undo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
            
            // Cmd/Ctrl + Shift + Z または Cmd/Ctrl + Y: Redo
            if (((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) || 
                ((e.metaKey || e.ctrlKey) && e.key === 'y')) {
                e.preventDefault();
                this.redo();
            }
        });
        
        // Step4: エクスポートボタン
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                exportBtn.disabled = true;
                exportBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>レンダリング中...';
                
                const result = await this.exportHighQuality();
                
                if (result.ok) {
                    // 成功表示
                    exportBtn.innerHTML = '<i class="fas fa-check-circle me-1"></i>完了';
                    exportBtn.classList.remove('btn-success');
                    exportBtn.classList.add('btn-outline-success');
                    
                    // 共有URL表示
                    const shareArea = document.getElementById('shareUrlArea');
                    const shareInput = document.getElementById('shareUrlInput');
                    const openLink = document.getElementById('openShareLinkBtn');
                    
                    const fullUrl = window.location.origin + result.share_url;
                    
                    if (shareArea && shareInput && openLink) {
                        shareInput.value = fullUrl;
                        openLink.href = result.share_url;
                        shareArea.style.display = 'block';
                    }
                    
                    setTimeout(() => {
                        exportBtn.innerHTML = '<i class="fas fa-check-circle me-1"></i>確定して保存';
                        exportBtn.classList.remove('btn-outline-success');
                        exportBtn.classList.add('btn-success');
                        exportBtn.disabled = false;
                    }, 2000);
                    
                } else {
                    // エラー表示
                    exportBtn.innerHTML = '<i class="fas fa-times me-1"></i>失敗';
                    exportBtn.classList.remove('btn-success');
                    exportBtn.classList.add('btn-danger');
                    
                    alert(`エクスポート失敗: ${result.error}`);
                    
                    setTimeout(() => {
                        exportBtn.innerHTML = '<i class="fas fa-check-circle me-1"></i>確定して保存';
                        exportBtn.classList.remove('btn-danger');
                        exportBtn.classList.add('btn-success');
                        exportBtn.disabled = false;
                    }, 2000);
                }
            });
        }
        
        // Step4: 共有URLコピーボタン
        const copyShareUrlBtn = document.getElementById('copyShareUrlBtn');
        if (copyShareUrlBtn) {
            copyShareUrlBtn.addEventListener('click', () => {
                const shareInput = document.getElementById('shareUrlInput');
                if (shareInput) {
                    shareInput.select();
                    document.execCommand('copy');
                    
                    const btn = copyShareUrlBtn;
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i> コピー済';
                    
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                    }, 1500);
                }
            });
        }
        
        console.log('✓ UIコントロールをバインドしました（Step4: エクスポート/共有URL追加）');
    }
}

// Step3への布石（コメントとして残す）
// TODO Step3: Undo/Redo と保存導線
// TODO Step4: サーバ側で高品質レンダリング確定版
