# Look Records Phase B 準備メモ

Phase B（スコア・コメント機能）に進む前に確認すべき事項と設計方針。

## Phase Aで確定した仕様

### 1. 保存内容

**保存されるもの:**
- Future Face適用後の合成結果
- 眉パーツ合成を含む
- 鼻パーツ合成を含む
- ベース画像 + Future Face + パーツ = 最終合成画像

**重要:**
これが評価基準となる。スコアリングはこの最終画像を基準にする。

### 2. 同日上書き仕様

**現在の実装:**
- 1日1件のみ保存（UNIQUE制約）
- 同日の再保存は上書き
- `is_updated: true` で明示

**ユーザーへの明示:**
- ボタン: "今日の記録として保存"
- 上書き時: "上書き保存しました"
- 1日複数回の保存は不可

**将来の拡張可能性:**
もし「1日複数回」が必要なら:
1. UNIQUE制約を削除
2. タイムスタンプでソート
3. 「今日の記録（1回目/2回目）」表示

ただし、現状の「1日1件」は以下の理由で適切:
- スコア評価がシンプル
- 比較グラフが作りやすい
- ユーザーの習慣化を促進

## Phase B 設計方針

### スコア機能の検討

#### A案: AI自動スコアリング（Gemini Vision）

**メリット:**
- 客観的評価
- 自動化

**デメリット:**
- コスト（画像解析）
- レスポンス時間
- API依存

**実装難易度:** 中

#### B案: 主観スコア（ユーザー入力）

**メリット:**
- コストゼロ
- 即座に反映
- ユーザーの実感ベース

**デメリット:**
- 主観的
- 入力の手間

**実装難易度:** 低

#### 推奨: B案（主観スコア）

Phase Bでは主観スコアを採用。
理由:
- MVP検証に十分
- コストを抑えられる
- ユーザーの「気づき」を促す

将来的にAIスコアを追加可能（併用）。

### DB設計案

#### look_records テーブル拡張

```sql
ALTER TABLE look_records ADD COLUMN score INTEGER;  -- 1-5 or 1-10
ALTER TABLE look_records ADD COLUMN comment TEXT;
```

または、既存テーブルはそのままで:

```sql
CREATE TABLE look_record_reviews (
    id INTEGER PRIMARY KEY,
    look_record_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    comment TEXT,
    created_at TIMESTAMP,
    FOREIGN KEY (look_record_id) REFERENCES look_records(id)
);
```

**推奨: look_records テーブル拡張**
- シンプル
- 1日1件と相性良い
- JOIN不要

### UI設計案

#### 保存時の入力

**オプションA: 保存後にモーダル**
1. 画像保存ボタンクリック
2. 保存成功
3. モーダル表示: "今日の満足度を評価してください"
4. スコア選択（1-5の星）
5. コメント入力（任意）
6. 保存

**オプションB: 保存前にフォーム**
1. 保存ボタンクリック
2. モーダル表示（画像プレビュー + フォーム）
3. スコア・コメント入力
4. 「保存」ボタン
5. 画像 + レビュー一括保存

**推奨: オプションA**
- UX的に自然（画像保存 → 評価）
- スキップ可能

#### 記録一覧での表示

- カードに星アイコン表示
- コメントはホバー表示 or 詳細ページ
- スコア平均を月ヘッダーに表示

### グラフ機能（Phase B+）

- X軸: 日付
- Y軸: スコア
- 線グラフ or 棒グラフ
- Chart.js 使用

### 比較機能（Phase B+）

- Before/After画像の並列表示
- スライダーで比較
- 「初回（開始日）vs 今日」

## マイグレーション計画

### Phase B マイグレーション

```python
# migrations/0008_add_look_record_reviews.py

def apply(db):
    db.execute_sql('''
        ALTER TABLE look_records 
        ADD COLUMN score INTEGER DEFAULT NULL
    ''')
    
    db.execute_sql('''
        ALTER TABLE look_records 
        ADD COLUMN comment TEXT DEFAULT NULL
    ''')
    
    print('✓ look_recordsにscore/comment追加')
```

### 既存データの扱い

- score: NULL許可
- comment: NULL許可
- 既存レコードは評価なし扱い

## API設計案

### POST /client/api/look-records/:id/review

```json
{
  "score": 4,
  "comment": "肌が明るくなった気がする"
}
```

レスポンス:
```json
{
  "ok": true,
  "record_id": 123,
  "score": 4
}
```

### 保存と同時に評価を送る場合

`POST /client/api/look-records/save` に追加:

```json
{
  "image_base64": "...",
  "preset": "all",
  "strength": 40,
  "score": 4,  // 追加
  "comment": "良い感じ"  // 追加（任意）
}
```

**推奨: 保存と評価は別**
- 段階的実装が容易
- エラーハンドリングが明確

## Phase Bの実装順序

1. **DB拡張** (0008 migration)
2. **評価API** (POST /api/look-records/:id/review)
3. **評価モーダルUI** (preview.html)
4. **一覧表示拡張** (look_records.html にスコア表示)
5. **グラフ表示** (新規ページ or ダッシュボード統合)

## 工数見積もり

- DB拡張: 30分
- 評価API: 1時間
- 評価モーダルUI: 2時間
- 一覧表示: 1時間
- グラフ表示: 3時間

**合計: 7.5時間**

## Phase Bのゴール

- [ ] スコア記録（1-5の星）
- [ ] コメント記録（任意）
- [ ] 一覧にスコア表示
- [ ] 月平均スコア表示

Phase B+ (後回し):
- [ ] グラフ表示
- [ ] Before/After比較
- [ ] 週間サマリー

## 参考: ユーザーストーリー

### Phase A (完了)
> "毎日Future Faceで作った画像を記録として残したい"

### Phase B (次)
> "記録した日の満足度を振り返りたい"

### Phase B+
> "1ヶ月の変化をグラフで見たい"

## メモ

- スコアは後から追加/変更可能にする
- コメントは編集可能にする
- 記録の削除機能は未実装（Phase C）

## 実装開始前のチェックリスト

- [ ] Phase A.1が完全に動作すること
- [ ] 既存ユーザーデータがあればバックアップ
- [ ] マイグレーション手順の確認
- [ ] モーダルUIのワイヤーフレーム作成
