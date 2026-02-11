# Future Face Phase1 & Phase2: Slim + Skin機能

## 📋 実装内容

### Phase1: Slim（輪郭調整）
- `slimJaw()`: 顎・頬を細くする
- `localWarp()`: 局所ワープ処理
- `JAW_SLIM_IDX`: 輪郭ランドマーク22点

### Phase2: Skin（肌改善）✨ NEW
- `skinEnhance()`: 肌を明るく滑らかに加工
- `buildSkinMask()`: 顔の輪郭マスク生成（目・眉・口・鼻孔除外）
- `featherMask()`: マスク境界を8pxぼかし
- `boxBlur()`: 軽量スムージング（radius=2）
- `adjustTone()`: 明るさ・彩度調整

### 修正ファイル
- `static/js/future_face.js`
  - Phase2実装追加（+261行）
  - マスク定義追加（顔輪郭36点、左目16点、右目16点、口20点、鼻孔5点）
  - `applyFutureFaceMVP()` にSkin処理統合
  
- `static/js/facemesh_preview.js`
  - RenderStateに`futureFace`と`cache`追加
  - `setFutureFace(patch)`: 設定変更API
  - `maybeUpdateFutureFaceCache()`: キャッシュ更新処理
  - `renderComposite()`: キャッシュ利用分岐
  
- `templates/face_template/preview.html`
  - `future_face.js`読み込み追加

## 🧪 動作確認手順

### 1. ローカルサーバー起動
```bash
source .venv/bin/activate
python app.py
```

### 2. ブラウザで顔合成ページを開く
```
http://localhost:8000/client/face-template/preview
```

### 3. コンソールで有効化

#### Phase1: Slim（輪郭調整）
```javascript
// 有効化（strength: 40）
setFutureFace({enabled: true, preset: "slim", strength: 40})

// strength変更（0-100）
setFutureFace({strength: 60})
```

#### Phase2: Skin（肌改善）✨ NEW
```javascript
// 肌改善のみ
setFutureFace({enabled: true, preset: "skin", strength: 50})

// 両方適用
setFutureFace({enabled: true, preset: "all", strength: 40})

// 無効化
setFutureFace({enabled: false})
```

## ✅ 確認ポイント

### Phase1: Slim（正常動作）
- ✅ 顎〜頬が"少し"締まる
- ✅ 鼻は歪まない（守られている）
- ✅ strength 0-100で段階的に変化

### Phase2: Skin（合格基準）✨ NEW
- ✅ 目元が溶けない（左目16点、右目16点で除外）
- ✅ 鼻孔周辺が不自然に明るくならない（鼻孔5点で除外）
- ✅ 肌が"プラス1段階"きれいになる（加工感は薄い）
- ✅ マスク境界が自然（8pxのfeather）

### 共通
- ✅ キャッシュが効いている（同じ設定で再計算されない）

### Phase2: 異常動作（要修正）
- ❌ 目元が溶ける → `LEFT_EYE_IDX`, `RIGHT_EYE_IDX`を拡大
- ❌ 口周辺が不自然 → `MOUTH_IDX`を拡大
- ❌ 加工が強すぎる → `alpha`の範囲を狭める（0.3-0.5）
- ❌ パフォーマンス悪化 → `boxBlur`のradiusを1に縮小

## 🎛️ パラメータ調整

### Phase1: Slim - `future_face.js`内の調整可能なパラメータ

```javascript
// slimJaw()内
const amount = lerp(0.02, 0.06, strength01); // 収縮率（2-6%）
const radius = Math.round(W * 0.08);         // ワープ半径（8%）
```

### Phase2: Skin - `future_face.js`内の調整可能なパラメータ✨ NEW

```javascript
// skinEnhance()内
const alpha = lerp(0.4, 0.6, strength01);    // 合成率（40-60%）

// boxBlur()
const radius = 2;                            // ブラー半径

// adjustTone()
const gamma = lerp(1.0, 1.15, strength01);   // ガンマ補正（1.0-1.15）
const saturation = lerp(1.0, 1.1, strength01); // 彩度（1.0-1.1）

// featherMask()
const featherRadius = 8;                      // マスク境界ぼかし（8px）
```

### Phase1: Slim破綻する場合の対処

1. **鼻が歪む場合**
   ```javascript
   // JAW_SLIM_IDXから額側のインデックスを削除
   const JAW_SLIM_IDX = [
       // 234, 93を削除してより顎寄りに限定
       132, 58, 172, 136, 150, 149, 176, 148, 152,
       377, 400, 378, 379, 365, 397, 288, 361, 323, 454
   ];
   ```

2. **収縮が強すぎる場合**
   ```javascript
   const amount = lerp(0.01, 0.04, strength01); // 1-4%に縮小
   ```

### Phase2: Skin破綻する場合の対処✨ NEW

1. **目元が溶ける場合**
   ```javascript
   // 左目の除外範囲を拡大（周辺ポイントを追加）
   const LEFT_EYE_IDX = [
       33, 7, 163, 144, 145, 153, 154, 155, 133,
       173, 157, 158, 159, 160, 161, 246,
       // 追加: 130, 243, 112 など眉下のポイント
   ];
   ```

2. **加工が強すぎる場合**
   ```javascript
   const alpha = lerp(0.3, 0.5, strength01); // 30-50%に縮小
   const gamma = lerp(1.0, 1.08, strength01); // 1.0-1.08に縮小
   ```

3. **処理が重い場合**
   ```javascript
   const radius = 1; // ブラー半径を1に縮小
   const featherRadius = 5; // featherを5pxに縮小
   ```

4. **口周辺が不自然な場合**
   ```javascript
   // 口の除外範囲を拡大
   const MOUTH_IDX = [
       61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
       291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
       // 追加: 13, 312, 311, 310 など口周辺のポイント
   ];
   ```

## 🔧 デバッグ

### コンソールログ確認
```javascript
// Future Face状態確認
console.log('RenderState:', RenderState)

// キャッシュ状態確認
console.log('Cache:', RenderState.cache.futureFace)

// ランドマーク確認
console.log('Landmarks:', window.preview.lastLandmarks?.length)
```

### 強制再計算
```javascript
// キャッシュをクリアして再計算
RenderState.cache.futureFace.dirty = true
setFutureFace({strength: 40})
```

## 📊 技術仕様

### Phase1: Slim - ランドマーク使用範囲
- **対象**: 顎〜頬の輪郭22点（MediaPipe FaceMesh: 234, 93, 132...）
- **除外**: 額、眉、鼻、目（変形しない）

### Phase1: Slim - ワープアルゴリズム
- **方式**: 局所ワープ（Local Warp）
- **重み**: 距離ベース（中心ほど強く変形）
- **方向**: x軸のみ（顔の幅を縮める）

### Phase2: Skin - マスク定義✨ NEW
- **顔の輪郭**: 36点（FACE_OUTLINE_IDX）
- **除外領域**:
  - 左目: 16点（LEFT_EYE_IDX）
  - 右目: 16点（RIGHT_EYE_IDX）
  - 口: 20点（MOUTH_IDX）
  - 鼻孔: 5点（NOSTRIL_IDX）

### Phase2: Skin - 処理フロー✨ NEW
1. **マスク構築** → 顔ポリゴン塗りつぶし、除外領域を黒で塗る
2. **マスクfeather** → 8pxのボックスブラーで境界をぼかす
3. **スムージング** → 元画像にradius=2のボックスブラー
4. **色調補正** → ガンマ補正（1.0-1.15）+ 彩度調整（1.0-1.1）
5. **ブレンド** → マスク × 合成率（40-60%）でアルファブレンド

### 共通: キャッシュ戦略
- **キー**: `preset:strength:width×height`
- **無効化**: 設定変更時に`dirty=true`
- **再計算**: `onResults()`でランドマーク取得後

## 🚀 次のフェーズ

### ~~Phase2: Skin（肌加工）~~ ✅ 完了
- ~~色調補正（明るさ・彩度）~~
- ~~肌荒れ補正（ぼかし処理）~~

### Phase3: Young（若返り）
- 目の拡大
- 額のシワ軽減

### Phase4: UI実装
- スライダー追加
- プレセット選択UI
- リアルタイムプレビュー

## 📝 既知の制限

### Phase1: Slim
- 初回計算時のみ若干のラグ（~100ms）
- 極端なstrength（80-100）では不自然になる可能性
- 横顔・斜め顔では効果が限定的

### Phase2: Skin✨ NEW
- 初回計算時のラグ（~200ms、マスク構築+ブラー処理）
- 極端なstrength（80-100）では明るすぎる可能性
- 横顔では除外領域が正確でない場合あり
- ボックスブラーのため、高品質なぼかしではない（軽量化優先）

---

**Branch**: `feature/future-face-phase1`  
**Commits**: 
- `4999577`: Phase1 Slim実装
- `274ce1f`: Phase2 Skin実装
- Latest: Phase2ドキュメント更新
