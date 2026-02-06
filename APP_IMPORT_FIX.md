# app.py Import エラー修正

## 問題
```
ModuleNotFoundError: No module named 'routes.api_face_adjustments'
```

## 原因
`app.py` で存在しないルートファイルをimportしていた：
- `routes/api_face_adjustments.py` - **未作成**

## 修正内容

### app.py

**変更前**:
```python
from routes.api_face_adjustments import api_adjustments
# ...
app.register_blueprint(api_adjustments)
```

**変更後**:
```python
# NOTE: Step4-B時点では未実装のため一旦外す
# from routes.api_face_adjustments import api_adjustments
# ...
# app.register_blueprint(api_adjustments)  # Step4-B: 未実装のため一旦外す
```

## 実在するBlueprint（そのまま残した）

✅ `routes/api_export.py` → `api_export`
✅ `routes/share.py` → `share_bp`
✅ `routes/auth.py` → `auth`
✅ `routes/users.py` → `users`
✅ `routes/client.py` → `client`
✅ `routes/face_template.py` → `face_template`
✅ `routes/system.py` → `system_bp`

## 受け入れ基準

```bash
# venv内で実行
source .venv/bin/activate

# 1. アプリ起動
python app.py
# 期待結果: ImportError が出ずに起動

# 2. ヘルスチェック
curl http://localhost:5000/healthz
# 期待結果: {"status":"ok","database":"connected"}

# 3. ログイン後の動作確認
# ブラウザでログイン → /client/face-template/preview
# 期待結果: 500エラーにならない

# 4. Share URL確認
# /share/face/<export_id>
# 期待結果: 404以外（export_idが存在する前提）
```

## 重要なルール（今後の事故防止）

### ルート追加時の正しい手順
1. **ファイル作成**: `routes/new_route.py` を作成
2. **Blueprint定義**: ファイル内で `new_bp = Blueprint(...)` を定義
3. **app.py登録**: `from routes.new_route import new_bp` と `app.register_blueprint(new_bp)`

### 絶対にやってはいけないこと
❌ `routes/` に無いものを `app.py` で import する
❌ 計画上のファイル名を先に import だけ書く

### なぜこうなったか
Step3・Step4の計画で `api_face_adjustments.py` が予定されていたが、実際には：
- Export機能は `routes/client.py` に統合された
- `api_face_adjustments.py` は作成されなかった
- しかし `app.py` の import だけが残っていた

## 修正日
2026-02-06

## Step4-Bの現状

Export機能は完全に動作しており、以下の構成になっています：

```
routes/
├── client.py          ← Export API実装済み
│   ├── POST /client/api/face-template/export-minimal
│   ├── GET /exports/<filename>
│   └── POST /api/face-template/retry-render/<id>
├── share.py           ← Share URL実装済み
│   └── GET /share/face/<export_id>
└── api_export.py      ← 補助的なAPI（必要に応じて使用）
```

**DBモデル不要**: JSON + PNG ファイルで完結
