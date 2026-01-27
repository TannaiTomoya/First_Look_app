# FirstLook - 第一印象コンサルティングプラットフォーム

失敗できない場面（商談・面接・婚活）の前に、第一印象を整えるためのマッチングプラットフォーム

## セットアップ

### 1. 仮想環境の有効化
```bash
source .venv/bin/activate
```

### 2. 依存関係のインストール
```bash
pip install -r requirements.txt
```

### 3. データベースのセットアップ
```bash
# テーブル作成
python db_manager.py create

# テストデータ投入（任意）
python db_manager.py seed

# テーブル確認
python db_manager.py show
```

### 4. アプリケーションの起動
```bash
python app.py
```

ブラウザで http://localhost:8000 にアクセス

**起動確認:**
- アプリケーションが正常に起動
- データベース接続が初期化
- ホーム画面が表示される

## プロジェクト構成

```
FirstLook_app/
├── app.py                 # Flaskアプリケーションのエントリーポイント
├── models.py              # データベースモデル（PeeWee）
├── db_manager.py          # データベース管理スクリプト
├── templates/             # HTMLテンプレート
│   └── index.html        # ホーム画面
├── static/               # 静的ファイル
│   └── css/
│       └── style.css     # スタイルシート
├── instance/              # データベースファイル
│   └── photoapp.db       # SQLiteデータベース
├── requirements.txt       # Python依存関係
├── requirements.md        # 要件定義書
├── features.md           # 機能一覧
├── routes.md             # ルーティング設計
├── screens.md            # 画面一覧
└── user_stories.md       # ユーザーストーリー
```

## MVP機能（最小実装）

1. 認証・アカウント管理
2. Coach検索・選択
3. 予約機能
4. 1対1チャット
5. 当日コンテンツ配信

## データベース管理コマンド

```bash
# ヘルプ表示
python db_manager.py help

# テーブル作成
python db_manager.py create

# テーブル削除（確認プロンプトあり）
python db_manager.py drop

# テーブルリセット（確認プロンプトあり）
python db_manager.py reset

# テーブル一覧とレコード数表示
python db_manager.py show

# テストデータ投入
python db_manager.py seed

# データベース詳細情報（統計・最新投稿など）
python db_manager.py info
```

## データベーススキーマ

- **users**: ユーザー情報
- **posts**: 投稿情報
- **likes**: いいね情報
- **comments**: コメント情報
- **follows**: フォロー関係

詳細は `.cursor/rules/database.mdc` を参照

## 技術スタック

- **Backend**: Flask 3.1.2
- **ORM**: PeeWee 3.19.0
- **認証**: Flask-Login 0.6.3
- **Database**: SQLite（開発環境）
- **Template Engine**: Jinja2
- **Port**: 8000
