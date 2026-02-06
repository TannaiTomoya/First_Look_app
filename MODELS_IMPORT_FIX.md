# models/__init__.py Import エラー修正

## 問題
```
ModuleNotFoundError: No module named 'models.face_adjustment'
```

## 原因
`models/__init__.py` で存在しないモジュールをimportしていた：
- `models/face_adjustment.py` - **未作成**
- `models/render_export.py` - ファイルは存在するが、中身が未実装

## 修正内容

### models/__init__.py

**変更前**:
```python
from models.face_adjustment import FaceAdjustment
from models.render_export import RenderExport

__all__ = [
    # ...
    "FaceAdjustment",
    "RenderExport",
]
```

**変更後**:
```python
# NOTE: Step4-B 時点では Export は JSON/PNG で成立しており、DBモデルは不要。
# 未実装モデルを import すると起動不能になるため、一旦外す。
# from models.face_adjustment import FaceAdjustment
# from models.render_export import RenderExport

__all__ = [
    # ...
    # "FaceAdjustment",  # Step4-B: 未実装のため一旦外す
    # "RenderExport",    # Step4-B: 未実装のため一旦外す
]
```

## 受け入れ基準

✅ `python app.py` で ImportError が消える
✅ ログイン〜プレビュー画面まで 500にならない

## テスト方法

```bash
# venv内で実行
source .venv/bin/activate  # または: . .venv/bin/activate

# アプリ起動
python app.py

# 期待結果: ImportError が出ずに起動する
```

## 補足

### Step4-B の現状
- Export機能は **JSON + PNG ファイル** で完全に動作
- DBモデル（`FaceAdjustment`, `RenderExport`）は **不要**

### 将来の実装（Step4-C以降）
DBモデルを追加する場合：
1. `models/face_adjustment.py` を作成
2. `class FaceAdjustment(BaseModel):` を実装
3. `models/render_export.py` に `class RenderExport(BaseModel):` を実装
4. `models/__init__.py` のコメントを解除

## 修正日
2026-02-06
