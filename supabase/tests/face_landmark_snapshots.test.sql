-- face_landmark_snapshots / face_landmark_consents の認可テスト。期待値は docs/authorization.md に従う
-- A: 所有者 / B: ログイン中の他人 / C: 管理者 / D: 同意していないユーザー
\set QUIET on

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.com'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@example.com'),
  ('dddddddd-0000-0000-0000-000000000004', 'd@example.com');
update public.profiles set role = 'admin' where id = 'cccccccc-0000-0000-0000-000000000003';
insert into public.look_records (id, user_id, photo_path) values
  ('1aaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'a/1.jpg'),
  ('1bbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'b/1.jpg');

create function tests.ins(extra_cols text default '', extra_vals text default '') returns text
language sql immutable
as $$
  select format(
    'insert into public.face_landmark_snapshots (%sjaw_width, cheek_width, jaw_ratio, face_aspect, yaw, pitch, roll, registration, quality_ok, model_version) values (%s1.3, 1.6, 0.8, 1.3, 0, 0, 0, ''matrix'', true, ''test'')',
    extra_cols, extra_vals)
$$;
grant execute on function tests.ins(text, text) to anon, authenticated;

\set RLS 'row-level security'
\set PERM 'permission denied'
\set CONSENT 'landmark consent required'

-- ===== A（所有者）=====
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;

select tests.denied(tests.ins(), :'CONSENT', '同意前は所有者でも登録できない');
select public.set_landmark_consent(true);
select tests.rows(tests.ins('look_record_id, ', '''1aaaaaaa-0000-0000-0000-000000000001'', '), 1,
  '同意後は所有者が自分の記録に紐づけて登録できる');
select tests.denied(tests.ins('look_record_id, ', '''1bbbbbbb-0000-0000-0000-000000000002'', '), :'RLS',
  '他人の写真記録には紐づけられない');
select tests.denied('update public.face_landmark_snapshots set jaw_ratio = 0.5', :'PERM',
  '所有者でも保存後の値は変更できない');
select tests.denied(
  'insert into public.face_landmark_snapshots (id, jaw_width, cheek_width, jaw_ratio, face_aspect, yaw, pitch, roll, registration, quality_ok, model_version) '
  || 'select id, 1, 1, 0.5, 1, 0, 0, 0, ''matrix'', true, ''x'' from public.face_landmark_snapshots '
  || 'on conflict (id) do update set jaw_ratio = excluded.jaw_ratio', :'PERM',
  'upsert でも保存後の値は変更できない');
select tests.ok((select count(*) from public.face_landmark_consents) = 1, '所有者は自分の同意状況を見られる');

-- ===== B（ログイン中の他人）=====
reset role;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
select public.set_landmark_consent(true);

select tests.ok((select count(*) from public.face_landmark_snapshots) = 0, '他人の snapshot は一覧に出ない');
select tests.ok((select count(*) from public.face_landmark_snapshots where look_record_id = '1aaaaaaa-0000-0000-0000-000000000001') = 0,
  '他人の snapshot は条件指定でも取得できない');
select tests.ok((select count(*) from public.face_landmark_consents) = 1, '他人の同意状況は見えない（自分の1件のみ）');
select tests.denied(tests.ins('user_id, ', '''aaaaaaaa-0000-0000-0000-000000000001'', '), :'RLS', '他人名義では登録できない');
select tests.denied(tests.ins('user_id, ', '''dddddddd-0000-0000-0000-000000000004'', '), :'RLS',
  '未同意の他人名義でも同じエラーになり、同意の有無が分からない');
select tests.denied('truncate public.face_landmark_snapshots', :'PERM', 'truncate で全行を消せない');
select tests.denied('truncate public.face_landmark_consents', :'PERM', 'truncate で同意を消せない');
select tests.denied('update public.face_landmark_snapshots set jaw_ratio = 0.5', :'PERM', '他人の snapshot は更新できない');
select tests.rows($$delete from public.face_landmark_snapshots where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 0,
  '他人の snapshot は削除できない');
select tests.rows($$delete from public.face_landmark_consents where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 0,
  '他人の同意は取り消せない');
select tests.denied($$insert into public.face_landmark_consents (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001') on conflict do nothing$$,
  :'RLS', '他人の同意は作れない');
select tests.rows(tests.ins(), 1, '他人も自分の分は登録できる');
select public.set_landmark_consent(true);

-- ===== C（管理者）=====
reset role;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
set role authenticated;

select tests.ok((select count(*) from public.face_landmark_snapshots) = 0, '管理者も他人の snapshot は見られない');
select tests.ok((select count(*) from public.face_landmark_consents) = 0, '管理者も他人の同意状況は見られない');
select tests.denied('update public.face_landmark_snapshots set jaw_ratio = 0.5', :'PERM', '管理者も他人の snapshot は更新できない');
select tests.rows('delete from public.face_landmark_snapshots', 0, '管理者も他人の snapshot は削除できない');
select public.set_landmark_consent(true);
-- 管理者は look_records を全件読めるため、look_records 側の RLS では防げない経路
select tests.denied(tests.ins('look_record_id, ', '''1aaaaaaa-0000-0000-0000-000000000001'', '), :'RLS',
  '管理者でも他人の写真記録には紐づけられない');
select tests.rows(tests.ins(), 1, '管理者も自分の分は登録できる');

-- ===== 未ログイン =====
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;

select tests.denied('select 1 from public.face_landmark_snapshots', :'PERM', '未ログインでは一覧を読めない');
select tests.denied(tests.ins('user_id, ', '''aaaaaaaa-0000-0000-0000-000000000001'', '), :'PERM', '未ログインでは登録できない');
select tests.denied('delete from public.face_landmark_snapshots', :'PERM', '未ログインでは削除できない');
select tests.denied('select public.set_landmark_consent(true)', :'PERM', '未ログインでは同意を変更できない');
select tests.denied('select 1 from public.face_landmark_consents', :'PERM', '未ログインでは同意状況を読めない');

-- ===== 他人・管理者の操作で A のデータが変わっていない =====
reset role;
select tests.ok(
  (select count(*) from public.face_landmark_snapshots where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and jaw_ratio = 0.8::real) = 1
    and exists (select 1 from public.face_landmark_consents where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '他人・管理者の操作後も所有者のデータと同意は変わっていない');

-- ===== A：削除と同意取り消し =====
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;

select tests.rows(tests.ins(), 1, '所有者は追加で登録できる');
select tests.rows('delete from public.face_landmark_snapshots where id = (select id from public.face_landmark_snapshots limit 1)', 1,
  '所有者は1件削除できる');
select tests.rows(tests.ins(), 1, '所有者は再び登録できる');
select tests.rows('delete from public.face_landmark_snapshots', 2, '所有者は自分の snapshot を全削除できる');

select tests.rows(tests.ins(), 1, '全削除後も同意中なら登録できる');
select public.set_landmark_consent(false);
select tests.ok(
  (select count(*) from public.face_landmark_snapshots) = 0 and (select count(*) from public.face_landmark_consents) = 0,
  '同意を取り消すと自分の snapshot が全削除される');
select tests.denied(tests.ins(), :'CONSENT', '同意取り消し後は登録できない');

select public.set_landmark_consent(true);
select tests.rows(tests.ins(), 1, '再同意後は登録できる');
select tests.rows('delete from public.face_landmark_consents', 1, '同意行を直接削除できる');
select tests.ok((select count(*) from public.face_landmark_snapshots) = 0, '同意行を直接削除しても全削除される');

reset role;
select tests.ok(
  (select count(*) from public.face_landmark_snapshots where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 1
    and (select count(*) from public.face_landmark_snapshots where user_id = 'cccccccc-0000-0000-0000-000000000003') = 1,
  '所有者の削除・取り消しは他人の snapshot に影響しない');
