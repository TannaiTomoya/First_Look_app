-- profiles の認可テスト。期待値は docs/authorization.md に従う
-- E: 本人 / F: ログイン中の他人
\set QUIET on

insert into auth.users (id, email) values
  ('eeeeeeee-0000-0000-0000-000000000005', 'e@example.com'),
  ('ffffffff-0000-0000-0000-000000000006', 'f@example.com');
update public.profiles set stripe_customer_id = 'cus_E' where id = 'eeeeeeee-0000-0000-0000-000000000005';
update public.profiles set stripe_customer_id = 'cus_F' where id = 'ffffffff-0000-0000-0000-000000000006';

\set PROTECTED 'cannot be changed by users'

select set_config('request.jwt.claim.sub', 'eeeeeeee-0000-0000-0000-000000000005', false);
set role authenticated;

select tests.denied($$update public.profiles set role = 'admin' where id = auth.uid()$$, :'PROTECTED',
  '本人でも role を admin に変えられない');
select tests.denied($$update public.profiles set stripe_customer_id = 'cus_F' where id = auth.uid()$$, :'PROTECTED',
  '本人でも stripe_customer_id を変えられない');
select tests.denied($$update public.profiles set stripe_customer_id = null where id = auth.uid()$$, :'PROTECTED',
  '本人でも stripe_customer_id を消せない');
select tests.rows($$update public.profiles set display_name = 'E2' where id = auth.uid()$$, 1,
  '本人は表示名を変更できる');
select tests.rows($$update public.profiles set display_name = 'hacked' where id = 'ffffffff-0000-0000-0000-000000000006'$$, 0,
  '他人のプロフィールは変更できない');

reset role;
select tests.ok(
  (select role from public.profiles where id = 'eeeeeeee-0000-0000-0000-000000000005') = 'client'
    and (select stripe_customer_id from public.profiles where id = 'eeeeeeee-0000-0000-0000-000000000005') = 'cus_E'
    and (select display_name from public.profiles where id = 'ffffffff-0000-0000-0000-000000000006') <> 'hacked',
  '拒否後も role・顧客 ID・他人の表示名は変わっていない');

set role service_role;
select tests.rows($$update public.profiles set stripe_customer_id = 'cus_E2' where id = 'eeeeeeee-0000-0000-0000-000000000005'$$, 1,
  'サーバー（service_role）は stripe_customer_id を設定できる');
reset role;
