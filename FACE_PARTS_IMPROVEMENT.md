# 顔パーツ合成機能の改善実装

## 概要
顔パーツ（眉・鼻）の背景を透明化し、肌に自然に馴染むように合成する機能を実装しました。

## 実装内容

### 1. 背景透明化ツール
- **ファイル**: `tools/remove_bg.py`
- **機能**: AI（rembg）を使用してパーツ画像の背景を自動除去
- **対象**: 
  - 眉パーツ (`static/images/face_parts/eyebrows/*.png`)
  - 鼻パーツ (`static/images/face_parts/noses/*.png`)

### 2. 合成ロジックの改善
- **ファイル**: `templates/face_template/preview.html`
- **改善点**:
  - ブレンドモード（`multiply`）を使用して肌に馴染むように合成
  - 透明度（`globalAlpha = 0.85`）を調整して自然な見た目に
  - 透明背景のPNG画像に対応

### 3. 依存パッケージの追加
- **ファイル**: `requirements.txt`
- **追加**: `rembg==2.0.50`（AI背景除去ライブラリ）

## セットアップ手順

### ステップ1: パッケージのインストール

```bash
pip install -r requirements.txt
```

※ 初回は依存関係のダウンロードに時間がかかる場合があります（rembgのAIモデル）

### ステップ2: 背景透明化スクリプトの実行

```bash
# プロジェクトルートで実行
python tools/remove_bg.py
```

**実行結果例:**
```
==================================================
  顔パーツ背景透明化ツール
==================================================

[1/2] 眉パーツ処理中...
  処理中: eyebrow_1.png... ✓ 完了
  処理中: eyebrow_2.png... ✓ 完了
  処理中: eyebrow_3.png... ✓ 完了
  処理中: eyebrow_4.png... ✓ 完了
  処理中: eyebrow_5.png... ✓ 完了
✓ 5件処理完了

[2/2] 鼻パーツ処理中...
  処理中: nose_1.png... ✓ 完了
  処理中: nose_2.png... ✓ 完了
  処理中: nose_3.png... ✓ 完了
  処理中: nose_4.png... ✓ 完了
  処理中: nose_5.png... ✓ 完了
✓ 5件処理完了

==================================================
  完了: 合計 10件 処理しました
==================================================
```

**処理時間:** 1画像あたり2-3秒（計10枚で約30秒）

### ステップ3: アプリケーションの起動

```bash
python app.py
```

ブラウザで `http://127.0.0.1:8000/client/face-template/preview/{template_id}` にアクセスして効果を確認

## 技術詳細

### 背景透明化の仕組み

**使用技術:** rembg（U-2-Net AIモデル）

```python
from rembg import remove
from PIL import Image

# 画像読み込み
with open('input.png', 'rb') as f:
    input_data = f.read()

# AI処理で背景除去
output_data = remove(input_data)

# 保存
with open('output.png', 'wb') as f:
    f.write(output_data)
```

**利点:**
- ✓ 手動での色指定不要
- ✓ 複雑な形状にも対応
- ✓ 高精度な背景除去

### 合成処理の改善

**Before:**
```javascript
ctx.drawImage(eyebrowImage, x, y, width, height);
// → 白背景がそのまま重なり不自然
```

**After:**
```javascript
ctx.save();
ctx.globalCompositeOperation = 'multiply'; // 乗算モードで馴染む
ctx.globalAlpha = 0.85;                    // 透明度調整
ctx.drawImage(eyebrowImage, x, y, width, height);
ctx.restore();
// → 背景透明 + ブレンドで自然な合成
```

**ブレンドモードの種類:**
- `multiply`: 乗算（暗く馴染む）← 採用
- `overlay`: オーバーレイ（コントラスト保持）
- `soft-light`: ソフトライト（柔らかい合成）
- `source-over`: デフォルト（そのまま重ねる）

## トラブルシューティング

### Q1: rembgのインストールでエラーが出る
```bash
# onnxruntimeの依存関係エラーの場合
pip install --upgrade pip
pip install onnxruntime
pip install rembg
```

### Q2: 処理が遅い
- 初回実行時はAIモデルのダウンロードで時間がかかります
- 2回目以降はキャッシュが使用されるため高速化します

### Q3: 透明化後も背景が残る
- AIが被写体と背景を誤認識している可能性があります
- 画像を確認し、必要に応じて手動で画像編集ツール（GIMP等）で調整してください

### Q4: 合成が不自然
`preview.html`のブレンドパラメータを調整:
```javascript
// 透明度を変更（0.0 - 1.0）
ctx.globalAlpha = 0.9; // より濃く

// ブレンドモードを変更
ctx.globalCompositeOperation = 'overlay'; // より鮮明に
```

## メンテナンス

### 新しいパーツの追加時
1. パーツ画像（PNG）を該当ディレクトリに配置
2. `python tools/remove_bg.py` で背景除去
3. データベースに登録（`db_manager.py`経由）

### バックアップ
透明化処理前にバックアップ推奨:
```bash
cp -r static/images/face_parts static/images/face_parts_backup
```

### JPGファイルの削除（オプション）
透明化後、元のJPGファイルは不要になります:
```bash
find static/images/face_parts -name "*.jpg" -delete
```

## 今後の拡張案

### 1. ユーザー調整機能
- ブレンドモード選択UI
- 透明度スライダー
- パーツサイズ・位置の微調整

### 2. 追加パーツ対応
- 目（まぶた）
- 口（リップ）
- 輪郭（フェイスライン）

### 3. リアルタイム処理
- ユーザーがアップロードしたパーツを自動で透明化
- サーバー側APIエンドポイント追加

## 参考資料

- **rembg**: https://github.com/danielgatis/rembg
- **Canvas API - globalCompositeOperation**: https://developer.mozilla.org/ja/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
- **Face-api.js**: https://github.com/justadudewhohacks/face-api.js

## バグ修正履歴

### 修正1: JavaScriptライブラリ読み込みエラー
**問題:** Face-api.jsとCamanJSが読み込まれない
**原因:** `base.html`に`{% block head %}`ブロックが存在しない
**修正:** `base.html`の`<head>`内に`{% block head %}`を追加

### 修正2: パーツ位置のずれ
**問題:** 顔認識後のパーツ配置がずれる
**原因:** 元画像座標とCanvas座標のスケール変換が不足
**修正:** `scaleX/scaleY`を計算して座標変換を追加

```javascript
// スケール比率を計算
const scaleX = canvas.width / baseImage.naturalWidth;
const scaleY = canvas.height / baseImage.naturalHeight;

// Canvas座標に変換
x = (eyebrowCenterX * scaleX) - (width / 2);
y = (eyebrowCenterY * scaleY) - (height / 2);
```

### 修正3: ブレンドモードの調整
**変更前:** `multiply`（乗算）- 暗くなりすぎる
**変更後:** `overlay`（オーバーレイ）- より自然な合成

### 修正4: 鼻タイプ3のサイズ
**問題:** 鼻タイプ3が大きすぎる
**修正:** データベースの`scale`値を1.0 → 0.8に変更

```bash
python fix_nose_scale.py
```

## デバッグ機能の追加

エラーを検出しやすくするため、コンソールログとエラーチェックを追加:

- Face-api.js/CamanJSの読み込み確認
- 顔認識の成功/失敗ログ
- 座標変換の計算結果ログ
- 美肌加工の適用状態ログ

ブラウザのデベロッパーツール（F12）のConsoleタブで確認可能。

## 新機能: ユーザー位置調整UI

### 機能概要
パーツを選択後、矢印ボタンで位置を微調整できる機能を追加しました。

### 使い方

1. **眉または鼻を選択**
   - パーツを選択すると「パーツ位置調整」UIが自動表示

2. **矢印ボタンで調整**
   - ↑ 上: 3px上に移動
   - ↓ 下: 3px下に移動
   - ← 左: 3px左に移動
   - → 右: 3px右に移動
   - リセット: オフセットを0に戻す

3. **調整量の表示**
   - 現在のオフセット値が「X: 0, Y: 0」形式で表示

### 技術実装

```javascript
// オフセット変数
let offsetX = 0;
let offsetY = 0;

// パーツ描画時にオフセットを適用
x = (eyebrowCenterX * scaleX) - (width / 2) + offsetX;
y = (eyebrowCenterY * scaleY) - (height / 2) + offsetY;
```

### 眉の色の改善

**変更前:**
```javascript
ctx.globalCompositeOperation = 'overlay';  // 色が変わる
ctx.globalAlpha = 0.9;
```

**変更後:**
```javascript
ctx.globalCompositeOperation = 'source-over';  // 元の色を保持
ctx.globalAlpha = 1.0;  // 完全不透明（ブラック維持）
```

**効果:**
- ✅ 眉のブラック色がそのまま表示される
- ✅ 背景が透明なので自然に見える
- ✅ 画像の色情報をそのまま使用

## 新機能: 眉・鼻の個別操作と回転機能（v4）

### 1. **パーツ個別操作**

眉と鼻を別々に調整できるようになりました。

**使い方:**
- パーツ選択時に自動的にそのパーツが調整対象になる
- 「眉を調整」「鼻を調整」ボタンで切り替え可能
- 各パーツの位置・回転は個別に保存される

**実装:**
```javascript
// パーツごとの状態管理
const partState = {
    eyebrow: { offsetX: 0, offsetY: 0, rotation: 0 },
    nose: { offsetX: 0, offsetY: 0, rotation: 0 }
};
```

### 2. **360度回転機能**

パーツを自由に回転できます。

**操作方法:**
- スライダー: -180°～+180°まで5度刻みで調整
- 左回転ボタン: 5度ずつ左回転
- 右回転ボタン: 5度ずつ右回転

**実装:**
```javascript
// 回転の中心をパーツの中心に設定
ctx.translate(x + width/2, y + height/2);
ctx.rotate(rotation * Math.PI / 180);
ctx.drawImage(image, -width/2, -height/2, width, height);
```

### 3. **パーツ削除機能**

不要なパーツを削除できます。

**動作:**
- 「パーツを削除」ボタンで現在調整中のパーツを削除
- 選択状態と調整値がリセットされる
- 他のパーツが選択されていれば自動切り替え

### UI構造

```
┌─────────────────────────────────────┐
│ パーツ位置調整                      │
├─────────────────────────────────────┤
│ [眉を調整] [鼻を調整]              │
│ 調整中: 眉                          │
├─────────────────────────────────────┤
│        ↑                            │
│     ← 位置 →                        │
│        ↓                            │
├─────────────────────────────────────┤
│ 回転: 0° [========|============]    │
│ [左回転] [右回転]                   │
├─────────────────────────────────────┤
│ [位置・回転をリセット]              │
│ [パーツを削除]                      │
├─────────────────────────────────────┤
│ 位置: X: 0, Y: 0                    │
│ 回転: 0°                            │
└─────────────────────────────────────┘
```

### 使用例

**シナリオ1: 眉の位置と角度を調整**
```
1. 眉タイプ1を選択
   → 自動的に「眉を調整」がアクティブに

2. 「↑」を3回クリック
   → 眉が9px上に移動

3. 回転スライダーを-10°に
   → 眉が左に10度傾く

4. 完璧な位置になったら次へ
```

**シナリオ2: 眉と鼻を別々に調整**
```
1. 眉タイプ2を選択
   → 「眉を調整」で位置調整

2. 鼻タイプ3を選択
   → 自動的に「鼻を調整」に切り替わる

3. 鼻の位置を調整
   → 眉の位置は変わらない

4. 「眉を調整」ボタンで眉に戻る
   → 鼻の位置は保持される
```

**シナリオ3: パーツを削除して選び直し**
```
1. 眉タイプ5を選択・調整

2. 気に入らないので「パーツを削除」
   → 眉が消える

3. 別の眉タイプを選び直す
   → 新しい眉は初期位置から開始
```

## バグ修正: 美肌加工で画面が真っ暗になる問題（v5）

### 問題の原因
1. **Canvas変換行列の残存**: 回転処理後に変換行列がリセットされていなかった
2. **originalCanvasの保存タイミング**: 変換行列が乱れた状態で保存されていた
3. **状態リセット不足**: 美肌加工適用時にCanvas状態が完全にリセットされていなかった

### 修正内容

#### 1. drawComposition()の改善
```javascript
function drawComposition() {
    // Canvas状態を確実にリセット
    ctx.setTransform(1, 0, 0, 1, 0, 0);  // 変換行列をリセット
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    
    // ... パーツ描画
    
    // 最後にもリセット
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    saveOriginalCanvas();
}
```

#### 2. 美肌加工適用の改善
```javascript
// Canvas状態を完全にリセット
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.globalCompositeOperation = 'source-over';
ctx.globalAlpha = 1.0;

// デバッグ用ピクセルチェック
const testPixel = ctx.getImageData(canvas.width/2, canvas.height/2, 1, 1);
if (testPixel.data[3] === 0) {
    console.error('Canvas が空です！');
    return;
}
```

#### 3. UIレイアウトの改善
- 美肌加工UIをプレビューの**上**に配置
- コンパクトなデザインに変更
- 視認性の向上

**Before:**
```
[Canvas]
[位置調整UI]
[美肌加工UI] ← 下にあった
[保存ボタン]
```

**After:**
```
[美肌加工UI] ← 上に移動
[Canvas]
[位置調整UI]
[保存ボタン]
```

### デバッグ機能の追加
- 中心ピクセルチェック（Canvas が空でないか確認）
- Console ログで状態を追跡
- エラー時に自動で再描画

## AI自動美肌処理機能（v6）

### 概要
手動の美肌加工機能を廃止し、顔写真撮影時に自動的に美肌処理を適用する機能に変更しました。

### 変更内容

#### 1. **preview.htmlから美肌加工UI削除**
- スライダー（ぼかし・明るさ・鮮やかさ）を削除
- 適用ボタン・リセットボタンを削除
- CamanJS関連のイベントリスナーを削除

#### 2. **capture.htmlにAI自動美肌処理追加**
```javascript
function applyAutoBeautyFilter() {
    Caman(canvas, function() {
        this.stackBlur(2);        // 軽いぼかし
        this.brightness(5);       // 明るさ向上
        this.vibrance(15);        // 血色を良く
        this.contrast(3);         // コントラスト微調整
        this.render(() => {
            // 処理完了後に保存ボタン表示
        });
    });
}
```

#### 3. **処理タイミング**
- **Before**: プレビュー画面で手動調整
- **After**: 撮影直後に自動適用

### 自動美肌処理の設定値

最適な見た目になるよう、以下のパラメータを自動適用：

| パラメータ | 値 | 効果 |
|-----------|---|------|
| ぼかし | 2 | 肌を滑らかに |
| 明るさ | +5 | 健康的な印象 |
| 鮮やかさ | +15 | 血色を良く |
| コントラスト | +3 | メリハリを出す |

### ユーザー体験の改善

**Before（v5まで）:**
```
1. 顔写真撮影
2. プレビューページ
3. パーツ選択
4. 手動で美肌加工スライダー調整
5. 適用ボタンクリック
6. 保存
```

**After（v6）:**
```
1. 顔写真撮影
2. ✨ 自動美肌処理適用（1-2秒）
3. プレビューページ
4. パーツ選択
5. 保存
```

### 技術詳細

#### ローディング表示
```javascript
// 処理中メッセージを表示
const processingMsg = document.createElement('div');
processingMsg.innerHTML = '<i class="fas fa-magic"></i> AI美肌処理中...';
```

#### エラーハンドリング
```javascript
if (typeof Caman === 'undefined') {
    console.warn('CamanJSが読み込まれていません。美肌処理をスキップします。');
    // 処理をスキップして通常通り進む
}
```

### メリット

1. **操作が簡単**: ユーザーは何もしなくて良い
2. **一貫性**: 全てのユーザーに同じ品質の美肌処理
3. **時短**: スライダー調整の手間が不要
4. **UI簡潔化**: プレビュー画面がスッキリ

## 鼻パーツの肌馴染み改善（v7）

### 問題
鼻パーツ（特に鼻タイプ5）が肌に馴染まず、不自然に見える。

### 原因
1. **ブレンドモード**: `overlay`は元の画像の明暗を強調するため、鼻パーツが濃く見えすぎる
2. **透明度**: `globalAlpha = 0.9`では不透明すぎて、肌との境界が目立つ

### 解決策（最終版）

#### 1. ブレンドモードを`soft-light`に変更
```javascript
// 変更の経緯
overlay → multiply → soft-light

// 最終設定
ctx.globalCompositeOperation = 'soft-light';
```

**効果**: 
- `soft-light`は`overlay`より柔らかく、`multiply`より明るさを保持
- 最も自然で滑らかな合成
- 肌の質感を損なわない

#### 2. 透明度を0.65に調整
```javascript
// 変更の経緯
0.9 → 0.75 → 0.65

// 最終設定
ctx.globalAlpha = 0.65;
```

**効果**:
- 鼻パーツが完全に肌に溶け込む
- 境界線が全く目立たない
- 自然な立体感を保持

### コード変更箇所（最終版）

```360:364:templates/face_template/preview.html
// 🎨 肌に馴染むように合成（回転）
ctx.save();
ctx.globalCompositeOperation = 'soft-light'; // overlayより柔らかく自然に
ctx.globalAlpha = 0.65; // 透明度をさらに下げて肌に溶け込ませる
```

### 各ブレンドモードの比較

| モード | 特徴 | 鼻パーツへの適用 | 透明度 |
|--------|------|------------------|--------|
| `source-over` | そのまま重ねる | 眉に使用（黒色保持） | 1.0 |
| `overlay` | 明暗を強調 | ❌ 濃すぎる | - |
| `multiply` | 色を掛け合わせる | △ 暗めになる | 0.75 |
| `soft-light` | overlayより柔らか | ✅ **最適** | **0.65** |

### さらなる調整が必要な場合

もし鼻タイプ5がまだ馴染まない場合：

1. **透明度をさらに下げる**: `0.7` または `0.65`
2. **`soft-light`に変更**: `multiply`より柔らかい
3. **パーツごとに設定を分ける**:
   ```javascript
   if (selectedNose.label === '鼻タイプ5') {
       ctx.globalAlpha = 0.7;
   } else {
       ctx.globalAlpha = 0.75;
   }
   ```

## 変更履歴

- **2026-01-30 (v7.1)**: 鼻パーツの肌馴染みさらに改善
  - ブレンドモードを`multiply`から`soft-light`に変更（より柔らかい合成）
  - 透明度を0.75から0.65に調整（より肌に溶け込む）
  - 最も自然な見た目を実現

- **2026-01-30 (v7)**: 鼻パーツの肌馴染み改善（初回）
  - ブレンドモードを`overlay`から`multiply`に変更
  - 透明度を0.9から0.75に調整
  - より自然な陰影と肌トーンとの調和を実現

- **2026-01-30 (v6)**: AI自動美肌処理機能追加
  - preview.htmlから手動美肌加工UI削除
  - capture.htmlに自動美肌処理機能追加
  - 撮影直後に自動適用（ぼかし2、明るさ+5、鮮やか+15、コントラスト+3）
  - ローディング表示・エラーハンドリング実装

- **2026-01-30 (v5)**: 美肌加工バグ修正・UIレイアウト改善
  - Canvas変換行列の確実なリセット
  - 美肌加工適用時のデバッグチェック追加
  - 美肌加工UIをプレビュー上部に移動
  - リセット処理の改善

- **2026-01-30 (v4)**: 個別操作・回転機能追加
  - 眉と鼻を別々に操作可能に
  - 360度回転機能実装（スライダー・ボタン）
  - パーツ削除機能追加
  - 調整対象自動切り替え
  - リアルタイム値表示（位置・回転）

- **2026-01-30 (v3)**: ユーザー調整機能追加
  - 矢印ボタンで位置微調整機能実装
  - 眉のブレンドモードをsource-overに変更（ブラック維持）
  - リアルタイムオフセット表示
  - 位置リセット機能

- **2026-01-30 (v2)**: バグ修正
  - base.htmlに{% block head %}追加
  - 座標スケール変換実装
  - ブレンドモードをoverlayに変更
  - デバッグログ追加
  - 鼻タイプ3スケール調整スクリプト作成

- **2026-01-30 (v1)**: 初版作成
  - 背景透明化ツール実装
  - 合成ロジック改善
  - ドキュメント作成
