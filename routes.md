<!-- routes.md -->
# routes.md（ルーティング設計）- FirstLook
※Web前提。パスは例。認証/ロールで保護。

## Auth
- GET  /login
- POST /login
- POST /logout
- GET  /register
- POST /register

## Public
- GET  /               （ログイン前ホーム：シーン/印象カード/事例カード）
- GET  /coaches         （コーチ一覧）
- GET  /coaches/{id}    （コーチ詳細）
- GET  /posts           （Before/After一覧：公開範囲がある場合）
- GET  /posts/{id}      （Before/After詳細）

## Client（要ログイン）
- GET  /app                       （ログイン後ホーム）
- GET  /profile                    （マイページ）
- GET  /profile/edit
- POST /profile/edit
- GET  /skin-check                 （肌診断フォーム）
- POST /skin-check                 （肌診断保存）
- GET  /bookings/new               （予約入力）
- POST /bookings/confirm           （予約確認）
- POST /bookings                   （予約確定）
- GET  /bookings/{id}              （予約詳細）
- GET  /chats                      （チャット一覧）
- GET  /chats/{id}                 （チャット詳細）
- POST /chats/{id}/messages        （送信）
- GET  /daily-check                （当日5分チェック）
- POST /daily-check                （チェック保存/完了）
- GET  /my/posts                   （自分のBefore/After一覧）
- GET  /my/posts/new               （投稿作成）
- POST /my/posts                   （投稿保存）
- GET  /my/posts/{id}              （投稿詳細）

## Coach（要ログイン + role=coach）
- GET  /coach/profile/edit
- POST /coach/profile/edit
- GET  /coach/menus
- GET  /coach/menus/new
- POST /coach/menus
- GET  /coach/menus/{id}/edit
- POST /coach/menus/{id}/edit
- GET  /coach/chats
- GET  /coach/chats/{id}
- POST /coach/chats/{id}/messages

## Upload（共通）
- POST /uploads/photo
  - purpose: profile / skin_check / daily_check / before / after など
