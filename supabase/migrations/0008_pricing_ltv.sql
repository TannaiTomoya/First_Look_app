-- LTV pricing: monthly vs annual plan interval on entitlements
alter table public.entitlements
  add column if not exists plan_interval text not null default 'none'
    check (plan_interval in ('none', 'month', 'year'));

alter table public.entitlements
  add column if not exists plan_renewals integer not null default 0;

comment on column public.entitlements.plan_interval is
  'none | month | year — annual unlocks year-only features';
comment on column public.entitlements.plan_renewals is
  'Completed billing cycles; year2+ pricing uses renewals >= 1 for annual';

-- Backfill existing premium users as monthly
update public.entitlements
set plan_interval = 'month'
where is_premium = true and plan_interval = 'none';
