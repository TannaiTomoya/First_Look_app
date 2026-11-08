-- coaches.verified と daily_actions の認可テスト。期待値は docs/authorization.md に従う
-- G: 相談員本人 / H: 管理者 / I: 一般ユーザー
\set QUIET on

insert into auth.users (id, email) values
  ('99999991-0000-0000-0000-000000000007', 'g@example.com'),
  ('99999992-0000-0000-0000-000000000008', 'h@example.com'),
  ('99999993-0000-0000-0000-000000000009', 'i@example.com');
update public.profiles set role = 'admin' where id = '99999992-0000-0000-0000-000000000008';
insert into public.coaches (id, user_id, name, verified) values
  ('c0000000-0000-0000-0000-000000000001', '99999991-0000-0000-0000-000000000007', 'G', false);

\set VERIFY 'only admins can verify coaches'
\set RLS 'row-level security'

-- ===== 相談員本人 =====
select set_config('request.jwt.claim.sub', '99999991-0000-0000-0000-000000000007', false);
set role authenticated;

select tests.denied($$update public.coaches set verified = true where id = 'c0000000-0000-0000-0000-000000000001'$$, :'VERIFY',
  '相談員本人は自分を認証済みにできない');
select tests.denied($$insert into public.coaches (user_id, name, verified) values (auth.uid(), 'G2', true)$$, :'VERIFY',
  '相談員本人は認証済みの行を作れない');
select tests.rows($$update public.coaches set bio = '自己紹介' where id = 'c0000000-0000-0000-0000-000000000001'$$, 1,
  '相談員本人は自己紹介を編集できる');
select tests.rows($$insert into public.coaches (user_id, name) values (auth.uid(), 'G3')$$, 1,
  '相談員本人は未認証の行を作れる');

-- ===== 一般ユーザー：他人の daily_actions =====
reset role;
select set_config('request.jwt.claim.sub', '99999993-0000-0000-0000-000000000009', false);
set role authenticated;
select tests.ok((select count(*) from public.daily_actions where user_id <> auth.uid()) = 0, '他人の毎日のアクションは見えない');
select tests.rows($$update public.daily_actions set completed = true where user_id = auth.uid()$$, 1,
  '本人は自分の毎日のアクションを更新できる');

-- ===== 管理者 =====
reset role;
select set_config('request.jwt.claim.sub', '99999992-0000-0000-0000-000000000008', false);
set role authenticated;

select tests.rows($$update public.coaches set verified = true where id = 'c0000000-0000-0000-0000-000000000001'$$, 1,
  '管理者は相談員を認証済みにできる');
select tests.ok((select count(*) from public.daily_actions where user_id = '99999993-0000-0000-0000-000000000009') = 1,
  '管理者は他人の毎日のアクションを見られる');
select tests.rows($$update public.daily_actions set title = 'x' where user_id = '99999993-0000-0000-0000-000000000009'$$, 0,
  '管理者も他人の毎日のアクションは更新できない');
select tests.rows($$delete from public.daily_actions where user_id = '99999993-0000-0000-0000-000000000009'$$, 0,
  '管理者も他人の毎日のアクションは削除できない');
select tests.denied($$insert into public.daily_actions (user_id, action_date) values ('99999993-0000-0000-0000-000000000009', current_date + 1)$$, :'RLS',
  '管理者も他人の毎日のアクションは作れない');

reset role;
select tests.ok(
  (select title from public.daily_actions where user_id = '99999993-0000-0000-0000-000000000009') <> 'x'
    and (select verified from public.coaches where id = 'c0000000-0000-0000-0000-000000000001'),
  '拒否後も他人の毎日のアクションは変わらず、管理者の認証は反映されている');
