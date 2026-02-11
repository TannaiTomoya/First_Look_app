# Future Face Phase1: Slim機能

## 📋 実装内容

### 新規ファイル
- `static/js/future_face.js` - Future Face処理ロジック
  - `slimJaw()`: 顎・頬を細くする
  - `localWarp()`: 局所ワープ処理
  - `JAW_SLIM_IDX`: 輪郭ランドマーク22点

### 修正ファイル
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
```javascript
// 有効化（strength: 40）
setFutureFace({enabled: true, preset: "slim", strength: 40})

// strength変更（0-100）
setFutureFace({strength: 60})

// 無効化
setFutureFace({enabled: false})
```

## ✅ 確認ポイント

### 正常動作
- ✅ 顎〜頬が"少し"締まる
- ✅ 鼻は歪まない（守られている）
- ✅ strength 0-100で段階的に変化
- ✅ キャッシュが効いている（同じ設定で再計算されない）

### 異常動作（要修正）
- ❌ 鼻が歪む → `JAW_SLIM_IDX`を顎寄りに絞る
- ❌ 極端に破綻する → `amount`の範囲を狭める（0.02-0.06）
- ❌ パフォーマンス悪化 → ワープ半径を小さくする

## 🎛️ パラメータ調整

### `future_face.js`内の調整可能なパラメータ

```javascript
// slimJaw()内
const amount = lerp(0.02, 0.06, strength01); // 収縮率（2-6%）
const radius = Math.round(W * 0.08);         // ワープ半径（8%）
```

### 破綻する場合の対処

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

3. **処理が重い場合**
   ```javascript
   const radius = Math.round(W * 0.06); // 6%に縮小
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

### ランドマーク使用範囲
- **対象**: 顎〜頬の輪郭22点（MediaPipe FaceMesh: 234, 93, 132...）
- **除外**: 額、眉、鼻、目（変形しない）

### ワープアルゴリズム
- **方式**: 局所ワープ（Local Warp）
- **重み**: 距離ベース（中心ほど強く変形）
- **方向**: x軸のみ（顔の幅を縮める）

### キャッシュ戦略
- **キー**: `preset:strength:width×height`
- **無効化**: 設定変更時に`dirty=true`
- **再計算**: `onResults()`でランドマーク取得後

## 🚀 次のフェーズ

### Phase2: Skin（肌加工）
- 色調補正（明るさ・彩度）
- 肌荒れ補正（ぼかし処理）

### Phase3: Young（若返り）
- 目の拡大
- 額のシワ軽減

### Phase4: UI実装
- スライダー追加
- プレセット選択UI
- リアルタイムプレビュー

## 📝 既知の制限

- 初回計算時のみ若干のラグ（~100ms）
- 極端なstrength（80-100）では不自然になる可能性
- 横顔・斜め顔では効果が限定的

---

**Branch**: `feature/future-face-phase1`  
**Commit**: `4999577`
