-- Growth Loop Phase 2
-- SQL Editor で実行（再実行可）。0004/0005 実行済み前提。

-- クリップジョブ（クラウドWorker相当のキュー。実行はクライアント or 外部Worker）
create table if not exists public.growth_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recording_id uuid references public.growth_recordings(id) on delete set null,
  kind text not null default 'clip'
    check (kind in ('clip', 'analyze', 'plan')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_jobs_user_status_idx
  on public.growth_jobs (user_id, status, created_at desc);

alter table public.growth_jobs enable row level security;
drop policy if exists "growth_jobs_select" on public.growth_jobs;
drop policy if exists "growth_jobs_insert" on public.growth_jobs;
drop policy if exists "growth_jobs_update" on public.growth_jobs;
create policy "growth_jobs_select" on public.growth_jobs for select
  to authenticated using (user_id = auth.uid());
create policy "growth_jobs_insert" on public.growth_jobs for insert
  to authenticated with check (user_id = auth.uid());
create policy "growth_jobs_update" on public.growth_jobs for update
  to authenticated using (user_id = auth.uid());

-- 発信プラン（丹内相談後など）
create table if not exists public.growth_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consultation_id uuid references public.consultations(id) on delete set null,
  title text,
  body text not null,
  posts jsonb not null default '[]'::jsonb,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

alter table public.growth_plans enable row level security;
drop policy if exists "growth_plans_select" on public.growth_plans;
drop policy if exists "growth_plans_insert" on public.growth_plans;
create policy "growth_plans_select" on public.growth_plans for select
  to authenticated using (user_id = auth.uid());
create policy "growth_plans_insert" on public.growth_plans for insert
  to authenticated with check (user_id = auth.uid());

-- クリップにテンプレA/B
alter table public.growth_clips add column if not exists template_key text;
alter table public.growth_metrics add column if not exists youtube_video_id text;
alter table public.growth_metrics add column if not exists external_url text;

-- 月次利用量
create table if not exists public.growth_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_key text not null, -- YYYY-MM
  coach_count integer not null default 0,
  clip_count integer not null default 0,
  primary key (user_id, month_key)
);

alter table public.growth_usage enable row level security;
drop policy if exists "growth_usage_select" on public.growth_usage;
create policy "growth_usage_select" on public.growth_usage for select
  to authenticated using (user_id = auth.uid());

grant all privileges on table public.growth_jobs to service_role;
grant all privileges on table public.growth_plans to service_role;
grant all privileges on table public.growth_usage to service_role;
grant select, insert, update on table public.growth_jobs to authenticated;
grant select, insert on table public.growth_plans to authenticated;
grant select on table public.growth_usage to authenticated;
