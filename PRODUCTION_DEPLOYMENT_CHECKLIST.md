# 本番環境反映完了 - 確認チェックリスト

## デプロイ状況

✅ **Gitプッシュ完了**
- Commit: `2938e15` - feat: 習慣化エンジン・LP・PWA実装（Phase C-F2）
- Branch: `main`
- 38ファイル変更、3197行追加

✅ **Render自動デプロイ開始**
- GitHubにプッシュされた時点でRenderの自動デプロイが開始
- デプロイログはRenderダッシュボードで確認

---

## 本番確認手順（デプロイ完了後）

### 1. Renderダッシュボード確認

1. **デプロイ完了を確認**
   - Render Dashboard > FirstLook > Events
   - "Deploy succeeded" のメッセージを確認
   - 所要時間: 通常5-10分

2. **ビルドログ確認**
   - エラーがないか確認
   - マイグレーションが実行されたか確認（ログに表示されるはず）

### 2. マイグレーション確認（重要）

**本番DBで未適用の場合、手動実行が必要:**

Renderのシェルから:
```bash
python scripts/migrate.py status
python scripts/migrate.py up
```

**確認ポイント:**
- 5つのマイグレーション（0010-0014）が全て適用済み
- エラーが出ていないこと

### 3. 静的ファイル配信確認

以下のURLが全て200 OKを返すか確認:

```
https://YOUR-APP.onrender.com/static/manifest.json
https://YOUR-APP.onrender.com/static/sw.js
https://YOUR-APP.onrender.com/static/icons/icon-192.png
https://YOUR-APP.onrender.com/static/icons/icon-512.png
https://YOUR-APP.onrender.com/static/js/pwa_install.js
```

### 4. LP確認

**未ログイン状態で:**
```
https://YOUR-APP.onrender.com/
```

**確認項目:**
- [ ] ダークテーマのLPが表示される
- [ ] 8セクション全て表示（HERO, 即体験, FEATURE, HOW TO, ベネフィット, FAQ, FINAL CTA, Footer）
- [ ] 3つのCTAボタンが動作（無料で体験する、今すぐ試す、無料で始める）
- [ ] レスポンシブ（スマホでも正常表示）

### 5. PWA機能確認

**Chrome（デスクトップ/Android）:**
1. LPにアクセス
2. DevTools > Application > Manifest
   - [ ] Name: "FirstLook"
   - [ ] Start URL: "/client/dashboard"
   - [ ] Icons: 192/512が表示
3. DevTools > Application > Service Workers
   - [ ] Status: activated
   - [ ] Source: /static/sw.js
4. 右下に「アプリとして使う」ボタンが表示
   - [ ] クリックでインストールプロンプト表示
   - [ ] インストール後、ホーム画面にアイコン追加

**iPhone（Safari）:**
1. LPにアクセス
2. 右下にiOS用説明が表示
3. 「共有」→「ホーム画面に追加」
   - [ ] アイコンが正しく表示
   - [ ] タイトル: "FirstLook"
4. ホーム画面から起動
   - [ ] スタンドアロンで表示（アドレスバー非表示）

### 6. 既存機能確認（回帰テスト）

**ログイン済みユーザーで:**

```
https://YOUR-APP.onrender.com/
```
- [ ] 自動的に`/client/dashboard`へリダイレクト

**ダッシュボード:**
```
https://YOUR-APP.onrender.com/client/dashboard
```
- [ ] ストリーク表示（現在/最長）
- [ ] Freeze表示（残数/使用通知）
- [ ] 達成バッジ表示
- [ ] 設定リンク表示
- [ ] メンタルセーフティ文言表示

**新機能ページ:**
- [ ] `/client/look-records/calendar` - カレンダービュー
- [ ] `/client/summary/week` - 週間サマリー
- [ ] `/client/settings` - 設定画面（スコア非表示トグル）
- [ ] `/client/referral` - 招待画面

**既存ページ:**
- [ ] `/login` - ログイン
- [ ] `/register` - 登録（招待コード入力欄）
- [ ] `/client/look-records` - 記録一覧（Self Care Score表記）
- [ ] `/client/progress` - 進化の証明（Self Care Score表記）
- [ ] `/client/face-template/preview` - Face Template

### 7. スコア非表示モードテスト

1. 設定画面で「スコア非表示」をON
2. 以下のページでスコア数値が非表示になるか確認:
   - [ ] look_records - UP/DOWN/SAME表示
   - [ ] look_records_calendar - 記録済表示
   - [ ] weekly_summary - 平均非表示、方向のみ
   - [ ] progress - 目のアイコン表示

### 8. 新規ユーザー登録テスト

1. 招待コードなしで登録
   - [ ] `referral_code`が自動生成される
   - [ ] `streak_freeze`が2に設定される
   - [ ] `hide_scores`が0（表示）に設定される

2. 招待コードありで登録
   - [ ] 紹介者と新規ユーザー両方にFreeze +1
   - [ ] `referred_by_id`が設定される

---

## トラブルシューティング

### 問題: マイグレーションエラー

**症状:**
- `AttributeError: User has no attribute 'hide_scores'`
- `AttributeError: User has no attribute 'referral_code'`

**原因:**
マイグレーションが未実行

**解決:**
```bash
# Renderシェルで実行
python scripts/migrate.py up
```

### 問題: PWAインストールボタンが出ない

**原因:**
1. HTTPSでない
2. Manifest/SWが読み込めていない
3. 既にインストール済み

**解決:**
1. HTTPSを確認
2. DevTools > Console でエラー確認
3. シークレットモードで試す

### 問題: 既存ユーザーでreferral画面エラー

**原因:**
`referral_code`がNULL

**解決:**
既に実装済み - referral画面アクセス時に自動生成されます

### 問題: Service Workerが更新されない

**解決:**
```javascript
// DevTools > Application > Service Workers
// "Unregister" をクリック
// ページリロード
```

---

## Cron Job設定（Reminder用）

Renderのダッシュボードで設定:

**名前:** Daily Reminders  
**コマンド:**
```bash
python scripts/send_reminders.py
```

**スケジュール:**
```
0 21 * * *
```
（毎日21時JST = 12時UTC）

**環境変数確認:**
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `APP_DOMAIN`

詳細は`render_cron.txt`を参照。

---

## 完了確認

全ての確認項目にチェックが入ったら、本番反映完了です。

**重要な変更:**
- データベーススキーマ変更（5つのマイグレーション）
- 新規エンドポイント追加（7個）
- PWA対応
- LP追加

**リリースノート作成推奨:**
ユーザーに通知する新機能:
- 週間サマリー・カレンダービュー
- ストリーク・Freeze機能
- 達成バッジ
- 友達招待
- スコア非表示設定
- PWAインストール対応
