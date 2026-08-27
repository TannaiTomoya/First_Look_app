-- FirstLook schema (Supabase Postgres + RLS)
-- Dashboard → SQL Editor で実行、または supabase db push

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  role text not null default 'client' check (role in ('client', 'coach', 'admin')),
  avatar_url text,
  desired_impression text,
  onboarding_completed boolean not null default false,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.look_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  photo_path text not null,
  note text,
  is_day0 boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_date date not null default current_date,
  title text not null default '眉・肌・髪型を1分チェック',
  completed boolean not null default false,
  unique (user_id, action_date)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_session_id text unique,
  amount integer not null,
  currency text not null default 'jpy',
  kind text not null,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  name text not null,
  bio text,
  specialty text,
  price_jpy integer not null default 5000,
  stripe_account_id text,
  verified boolean not null default false,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid references public.coaches(id),
  calendly_event_uri text,
  payment_id uuid references public.payments(id),
  status text not null default 'pending',
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  extra_simulations integer not null default 0,
  is_premium boolean not null default false,
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    split_part(coalesce(new.email, 'user'), '@', 1) || '-' || substr(new.id::text, 1, 8)
  );
  insert into public.entitlements (user_id) values (new.id);
  insert into public.daily_actions (user_id, title)
  values (new.id, '眉・肌・髪型を1分チェック')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.look_records enable row level security;
alter table public.daily_actions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.coaches enable row level security;
alter table public.consultations enable row level security;
alter table public.entitlements enable row level security;

create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid());

create policy "looks_select" on public.look_records for select
  using (user_id = auth.uid() or public.is_admin());
create policy "looks_insert" on public.look_records for insert
  with check (user_id = auth.uid());
create policy "looks_delete" on public.look_records for delete
  using (user_id = auth.uid());

create policy "actions_all" on public.daily_actions for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

create policy "subs_select" on public.subscriptions for select
  using (user_id = auth.uid() or public.is_admin());

create policy "payments_select" on public.payments for select
  using (user_id = auth.uid() or public.is_admin());

create policy "coaches_public_read" on public.coaches for select
  using (true);
create policy "coaches_owner_write" on public.coaches for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "consult_select" on public.consultations for select
  using (user_id = auth.uid() or public.is_admin());
create policy "consult_insert" on public.consultations for insert
  with check (user_id = auth.uid());

create policy "entitlements_select" on public.entitlements for select
  using (user_id = auth.uid() or public.is_admin());

insert into storage.buckets (id, name, public)
values ('looks', 'looks', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "looks_storage_select" on storage.objects for select
  using (bucket_id = 'looks' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()));
create policy "looks_storage_insert" on storage.objects for insert
  with check (bucket_id = 'looks' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "looks_storage_delete" on storage.objects for delete
  using (bucket_id = 'looks' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars_owner_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

insert into public.coaches (name, bio, specialty, price_jpy, verified)
values
  ('高橋 健', '商談前の清潔感を最短で整えます。眉と髪型の再現性を重視。', '商談・面接', 8000, true),
  ('佐藤 みお', '婚活・日常の第一印象。やりすぎないメンズケアが専門。', '婚活・日常', 6000, true)
on conflict do nothing;
