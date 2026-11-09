-- Growth Loop Phase 1: highlights / clips / storage
-- SQL Editor で実行（再実行可）。0004_growth.sql 実行済み前提。

alter table public.growth_recordings
  add column if not exists public_url text;

create table if not exists public.growth_highlights (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.growth_recordings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_sec numeric not null,
  end_sec numeric not null,
  score numeric not null default 0,
  reason text,
  selected boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists growth_highlights_recording_idx
  on public.growth_highlights (recording_id);

alter table public.growth_highlights enable row level security;
drop policy if exists "growth_highlights_select" on public.growth_highlights;
drop policy if exists "growth_highlights_insert" on public.growth_highlights;
drop policy if exists "growth_highlights_update" on public.growth_highlights;
drop policy if exists "growth_highlights_delete" on public.growth_highlights;
create policy "growth_highlights_select" on public.growth_highlights for select
  to authenticated using (user_id = auth.uid());
create policy "growth_highlights_insert" on public.growth_highlights for insert
  to authenticated with check (user_id = auth.uid());
create policy "growth_highlights_update" on public.growth_highlights for update
  to authenticated using (user_id = auth.uid());
create policy "growth_highlights_delete" on public.growth_highlights for delete
  to authenticated using (user_id = auth.uid());

create table if not exists public.growth_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recording_id uuid references public.growth_recordings(id) on delete set null,
  highlight_id uuid references public.growth_highlights(id) on delete set null,
  storage_path text not null,
  caption text,
  hashtags text[],
  platform_hint text,
  short_id uuid,
  created_at timestamptz not null default now()
);

alter table public.growth_clips enable row level security;
drop policy if exists "growth_clips_select" on public.growth_clips;
drop policy if exists "growth_clips_insert" on public.growth_clips;
drop policy if exists "growth_clips_update" on public.growth_clips;
create policy "growth_clips_select" on public.growth_clips for select
  to authenticated using (user_id = auth.uid());
create policy "growth_clips_insert" on public.growth_clips for insert
  to authenticated with check (user_id = auth.uid());
create policy "growth_clips_update" on public.growth_clips for update
  to authenticated using (user_id = auth.uid());

-- recordings の更新権限
drop policy if exists "growth_recordings_update" on public.growth_recordings;
create policy "growth_recordings_update" on public.growth_recordings for update
  to authenticated using (user_id = auth.uid());

grant all privileges on table public.growth_highlights to service_role;
grant all privileges on table public.growth_clips to service_role;
grant select, insert, update, delete on table public.growth_highlights to authenticated;
grant select, insert, update on table public.growth_clips to authenticated;
grant update on table public.growth_recordings to authenticated;

-- Storage: 録画・クリップ（公開URLでプレビュー）
insert into storage.buckets (id, name, public)
values ('growth', 'growth', true)
on conflict (id) do nothing;

drop policy if exists "growth_storage_read" on storage.objects;
drop policy if exists "growth_storage_write" on storage.objects;
create policy "growth_storage_read" on storage.objects for select
  using (bucket_id = 'growth');
create policy "growth_storage_write" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'growth' and auth.uid()::text = (storage.foldername(name))[1]);
