FirstLook 要件定義書

0. 目的
	•	話す前の一瞬に生まれる「見た目が原因の不安」を減らし、最低限の第一印象を整える
	•	画像カード中心で比較→予約で、予約前の解像度を上げる
	•	コアフロー：印象選択 → 肌診断 → コーチ一覧/詳細（事例）→ 予約 → チャット自動生成 → 当日5分チェック → Before/After記録

⸻

1. 対象ユーザー
	•	Client：商談/面接/デート/婚活など「失敗できない場」を控え、何を直せばよいか分からない人
	•	Coach：眉・表情・服装などの最低限テンプレを提示できる専門家

⸻

2. 機能要件（P0）

2.1 認証・ロール
	•	新規登録（メール/パスワード）
	•	ログイン/ログアウト
	•	ロール：Client / Coach
	•	セッション管理（無操作30分タイムアウト）

2.2 印象カード（なりたい顔/印象の画像選択）
	•	画像カード一覧表示
	•	1枚選択してプロフィールに保存（desired_face_id 相当）
	•	画面上に「選択中の印象カード」を表示できる

2.3 肌診断（入力フォーム）
	•	肌状態（単一選択：乾燥/脂性/混合/普通 など）
	•	今の悩み（複数選択：毛穴開き/黒ずみ/肌トーン/ニキビケア）
	•	保存（最新1件で可）

2.4 コーチ一覧（Hot Pepper風カード）
	•	コーチ一覧表示（カード形式）
	•	画像（雰囲気）
	•	得意印象カード（タグ）
	•	価格帯（目安）
	•	エリア（目安）
	•	コーチ詳細へ遷移できる

2.5 コーチ詳細（予約の解像度を上げる）
	•	コーチプロフィール表示（自己紹介/実績）
	•	メニュー一覧表示（タイトル/内容/価格/所要時間）
	•	Before/After事例カード表示（投稿のサムネをカードで見せる）
	•	予約導線（予約入力へ）

2.6 予約
	•	予約入力（日時・メニュー）
	•	予約確認
	•	予約確定
	•	予約詳細（最低限）

2.7 予約完了で1対1チャット自動生成
	•	Booking確定時にChatを1:1で作成
	•	チャット一覧表示
	•	チャット詳細表示
	•	テキスト送受信（Message作成）

2.8 当日5分チェック（固定）
	•	チェック項目（固定）
	•	眉：ボサボサではないか
	•	目：クマが出ていないか
	•	鼻：鼻毛が出ていないか
	•	肌：乾燥していないか
	•	口：唇は乾燥していないか
	•	チェック実行→保存（当日分1件で可）
	•	完了ボタン

2.9 写真保存（P0に必要な最小）
	•	画像アップロード（jpg/png）
	•	保存用途（purpose）を保持
	•	coach_profile / before / after （最低限）
	•	DBには画像の保存先（path or url）を保持

2.10 Before/After投稿（作成・一覧・詳細）
	•	投稿作成
	•	Before画像（必須）
	•	After画像（必須）
	•	コメント（任意）
	•	紐付け：印象カード（任意）
	•	投稿一覧（画像カード表示）
	•	投稿詳細（Before/After比較）

⸻

3. 画面要件（P0）

共通
	•	ログイン
	•	新規登録

Client
	•	ホーム（シーン/印象カード選択導線）
	•	印象カード選択
	•	肌診断フォーム
	•	コーチ一覧（カード）
	•	コーチ詳細（事例カード＋予約導線）
	•	予約入力 → 予約確認 → 予約完了
	•	チャット一覧 → チャット詳細
	•	当日5分チェック
	•	Before/After：投稿作成 / 一覧 / 詳細
	•	マイページ（最低限：プロフィール/予約履歴）

Coach
	•	プロフィール編集（最低限）
	•	メニュー管理（最低限：作成/一覧）
	•	チャット一覧 → チャット詳細

⸻

4. データ要件（P0：主要エンティティ）
	•	Users：id, email, password_hash, name, role, created_at, updated_at
	•	Coaches（User拡張）：user_id, bio, expertise, area, price_range, profile_photo_id
	•	Menus：id, coach_id, title, description, price, duration
	•	Bookings：id, client_id, menu_id, booking_date, status
	•	Chats：id, booking_id
	•	Messages：id, chat_id, sender_id, content, sent_at
	•	DesiredFaces（印象カード）：id, label, image_url
	•	SkinChecks：id, user_id, skin_type, concerns, created_at
	•	DailyChecks：id, user_id, date, eyebrow_ok, eye_ok, nose_ok, skin_ok, lip_ok, created_at
	•	Photos：id, user_id, purpose, path/url, created_at
	•	BeforeAfterPosts：id, user_id, before_photo_id, after_photo_id, caption, desired_face_id, created_at

⸻

5. 非機能要件（P0）

セキュリティ
	•	HTTPS（本番）
	•	パスワードはハッシュ化（bcrypt）
	•	CSRF対策（フォーム）
	•	XSS対策（テンプレートエスケープ）
	•	ログイン試行制限（5回/15分）

画像アップロード
	•	拡張子：jpg/png
	•	容量上限：5MB（目安）
	•	保存先パスをDBで管理

パフォーマンス（目標）
	•	主要画面：3秒以内
	•	検索/一覧：2秒以内
	•	チャット送信：1秒以内（MVPはポーリングで可）

信頼性
	•	予約確定時に Chat が必ず作成される（整合性）
	•	エラー時はユーザー向けメッセージ表示（スタックトレース非表示）

⸻

6. 成功条件（P0完了の定義）
	•	Clientが「印象カード選択→肌診断→コーチ詳細の事例確認→予約→チャット→当日チェック→Before/After投稿」まで完走できる
	•	予約確定でチャットが自動生成される
	•	Before/Afterがカードで一覧化され、予約前の解像度が上がる導線になっている
