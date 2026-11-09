-- ローカル Postgres で RLS を検証するための最小 Supabase 互換スタブ（本番には適用しない）
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[]
language sql immutable
as $$ select string_to_array(name, '/') $$;

-- Supabase 既定の最も広い権限（anon / authenticated にも全テーブル ALL）。
-- 0003_features.sql の権限修復はこれより狭いので、ここで通ればどちらでも通る
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;
alter default privileges in schema tests grant execute on functions to service_role;
create function tests.ok(cond boolean, name text) returns void
language plpgsql
as $$
begin
  if cond then
    raise notice 'ok - %', name;
  else
    raise notice 'not ok - %', name;
  end if;
end;
$$;
grant execute on function tests.ok(boolean, text) to anon, authenticated;

-- sql を実行し、エラーメッセージが pattern に一致したら ok。成功や別理由のエラーは not ok
create function tests.denied(sql text, pattern text, name text) returns void
language plpgsql
as $$
begin
  execute sql;
  raise notice 'not ok - % (成功してしまった)', name;
exception when others then
  if sqlerrm ~ pattern then
    raise notice 'ok - %', name;
  else
    raise notice 'not ok - % (別の理由: %)', name, sqlerrm;
  end if;
end;
$$;
grant execute on function tests.denied(text, text, text) to anon, authenticated;

-- sql を実行し、影響行数が expected なら ok
create function tests.rows(sql text, expected int, name text) returns void
language plpgsql
as $$
declare n int;
begin
  execute sql;
  get diagnostics n = row_count;
  perform tests.ok(n = expected, name || case when n = expected then '' else format(' (実際 %s 行)', n) end);
exception when others then
  raise notice 'not ok - % (エラー: %)', name, sqlerrm;
end;
$$;
grant execute on function tests.rows(text, int, text) to anon, authenticated;
