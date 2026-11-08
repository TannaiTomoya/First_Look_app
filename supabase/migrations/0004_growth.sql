-- Growth Loop Phase 0/1 スキーマ
-- Supabase SQL Editor で実行（再実行可）

grant usage on schema public to anon, authenticated, service_role;

-- 指標（手入力MVP）
create table if not exists public.growth_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  clip_id uuid,
  platform text not null,
  posted_at date,
  views integer not null default 0,
  likes integer not null default 0,
  saves integer not null default 0,
  comments integer not null default 0,
  follows_delta integer not null default 0,
  note text,
  title text,
  created_at timestamptz not null default now()
);

create index if not exists growth_metrics_user_created_idx
  on public.growth_metrics (user_id, created_at desc);

alter table public.growth_metrics enable row level security;

drop policy if exists "growth_metrics_select" on public.growth_metrics;
drop policy if exists "growth_metrics_insert" on public.growth_metrics;
drop policy if exists "growth_metrics_update" on public.growth_metrics;
drop policy if exists "growth_metrics_delete" on public.growth_metrics;

create policy "growth_metrics_select" on public.growth_metrics for select
  to authenticated using (user_id = auth.uid());
create policy "growth_metrics_insert" on public.growth_metrics for insert
  to authenticated with check (user_id = auth.uid());
create policy "growth_metrics_update" on public.growth_metrics for update
  to authenticated using (user_id = auth.uid());
create policy "growth_metrics_delete" on public.growth_metrics for delete
  to authenticated using (user_id = auth.uid());

-- 音声壁打ちセッション
create table if not exists public.growth_coach_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transcript text,
  summary text,
  metrics_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.growth_coach_sessions enable row level security;

drop policy if exists "growth_coach_select" on public.growth_coach_sessions;
drop policy if exists "growth_coach_insert" on public.growth_coach_sessions;

create policy "growth_coach_select" on public.growth_coach_sessions for select
  to authenticated using (user_id = auth.uid());
create policy "growth_coach_insert" on public.growth_coach_sessions for insert
  to authenticated with check (user_id = auth.uid());

-- Phase 1 用（録画メタ）。Phase 0 では未使用でも作成しておく
create table if not exists public.growth_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  source text,
  storage_path text,
  duration_sec numeric,
  status text not null default 'uploaded',
  created_at timestamptz not null default now()
);

alter table public.growth_recordings enable row level security;
drop policy if exists "growth_recordings_select" on public.growth_recordings;
drop policy if exists "growth_recordings_insert" on public.growth_recordings;
create policy "growth_recordings_select" on public.growth_recordings for select
  to authenticated using (user_id = auth.uid());
create policy "growth_recordings_insert" on public.growth_recordings for insert
  to authenticated with check (user_id = auth.uid());

grant all privileges on table public.growth_metrics to service_role;
grant all privileges on table public.growth_coach_sessions to service_role;
grant all privileges on table public.growth_recordings to service_role;
grant select, insert, update, delete on table public.growth_metrics to authenticated;
grant select, insert on table public.growth_coach_sessions to authenticated;
grant select, insert on table public.growth_recordings to authenticated;
