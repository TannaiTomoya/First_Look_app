-- 追加機能: ショート動画 / 相談トピック / 相談員（丹内 智弥）
-- SQL Editor で実行（再実行可）

-- ============================================================
-- 最重要: 権限修復
-- 「profile作成に失敗: permission denied for table profiles」の根本原因。
-- service_role / authenticated / anon にテーブル権限が付与されていないため、
-- Supabase 標準のロール権限を再付与する（RLS はこれとは別に効き続ける）。
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on all tables in schema public to anon;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;

alter table public.consultations add column if not exists topic text;

create table if not exists public.shorts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

alter table public.shorts enable row level security;

drop policy if exists "shorts_select" on public.shorts;
drop policy if exists "shorts_insert" on public.shorts;
drop policy if exists "shorts_delete" on public.shorts;

create policy "shorts_select" on public.shorts for select
  to authenticated using (true);
create policy "shorts_insert" on public.shorts for insert
  to authenticated with check (user_id = auth.uid());
create policy "shorts_delete" on public.shorts for delete
  to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('shorts', 'shorts', true)
on conflict (id) do nothing;

drop policy if exists "shorts_storage_read" on storage.objects;
drop policy if exists "shorts_storage_write" on storage.objects;

create policy "shorts_storage_read" on storage.objects for select
  using (bucket_id = 'shorts');
create policy "shorts_storage_write" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'shorts' and auth.uid()::text = (storage.foldername(name))[1]);

-- 相談員: 丹内 智弥
insert into public.coaches (name, bio, specialty, price_jpy, verified)
select '丹内 智弥', '第一印象・婚活の個別相談を担当。記録データをもとに、次の一手を一緒に決めます。', '婚活相談・第一印象', 4980, true
where not exists (select 1 from public.coaches where name = '丹内 智弥');
