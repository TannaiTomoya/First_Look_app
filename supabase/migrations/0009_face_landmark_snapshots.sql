-- 顔の構造指標の時系列（#6）。権限は docs/authorization.md の face_landmark_snapshots に従う
-- 478点の座標や画像は保存しない。管理者も他人の行は読めない（is_admin() を使わない）

-- 同意は profiles に置かない（profiles_select は管理者に全行を見せるため）。行がある = 同意済み
create table if not exists public.face_landmark_consents (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  consented_at timestamptz not null default now()
);

create table if not exists public.face_landmark_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  look_record_id uuid references public.look_records(id) on delete cascade,
  jaw_width real not null check (jaw_width > 0 and jaw_width < 10),
  cheek_width real not null check (cheek_width > 0 and cheek_width < 10),
  jaw_ratio real not null check (jaw_ratio > 0 and jaw_ratio < 2),
  face_aspect real not null check (face_aspect > 0 and face_aspect < 5),
  yaw real not null check (yaw between -90 and 90),
  pitch real not null check (pitch between -90 and 90),
  roll real not null check (roll between -180 and 180),
  registration text not null check (registration in ('matrix', 'landmarks')),
  quality_ok boolean not null,
  model_version text not null check (char_length(model_version) <= 80),
  captured_at timestamptz not null default now()
);

create index if not exists face_landmark_snapshots_user_time
  on public.face_landmark_snapshots (user_id, captured_at);

revoke all on public.face_landmark_consents, public.face_landmark_snapshots from anon;
revoke update, truncate on public.face_landmark_consents, public.face_landmark_snapshots from authenticated;

alter table public.face_landmark_consents enable row level security;
alter table public.face_landmark_snapshots enable row level security;

drop policy if exists "face_consents_select_own" on public.face_landmark_consents;
create policy "face_consents_select_own" on public.face_landmark_consents
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "face_consents_insert_own" on public.face_landmark_consents;
create policy "face_consents_insert_own" on public.face_landmark_consents
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "face_consents_delete_own" on public.face_landmark_consents;
create policy "face_consents_delete_own" on public.face_landmark_consents
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "face_snapshots_select_own" on public.face_landmark_snapshots;
create policy "face_snapshots_select_own" on public.face_landmark_snapshots
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- 本人名義・同意済み・本人の記録だけを参照できる
drop policy if exists "face_snapshots_insert_own" on public.face_landmark_snapshots;
create policy "face_snapshots_insert_own" on public.face_landmark_snapshots
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.face_landmark_consents c
      where c.user_id = (select auth.uid())
    )
    and (
      look_record_id is null
      or exists (
        select 1 from public.look_records r
        where r.id = look_record_id and r.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "face_snapshots_delete_own" on public.face_landmark_snapshots;
create policy "face_snapshots_delete_own" on public.face_landmark_snapshots
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- update ポリシーは作らない（保存後は変更不可）

-- 登録中は同意行を共有ロックする。取り消し（同意行の削除）と並行しても、
-- 登録が先なら取り消しが待って全削除に含め、取り消しが先なら登録が失敗する
create or replace function public.lock_landmark_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- RLS より先に動くため、他人名義は何も読まずに RLS に拒否させる（同意の有無を漏らさない）
  if new.user_id is distinct from auth.uid() then
    return new;
  end if;
  perform 1 from public.face_landmark_consents where user_id = new.user_id for share;
  if not found then
    raise exception 'landmark consent required' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists face_snapshots_lock_consent on public.face_landmark_snapshots;
create trigger face_snapshots_lock_consent
  before insert on public.face_landmark_snapshots
  for each row execute function public.lock_landmark_consent();

-- 同意行が消えたら、誰が消しても同じトランザクションで本人の snapshot を全削除する
create or replace function public.purge_snapshots_on_consent_revoke()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.face_landmark_snapshots where user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists face_consents_purge_snapshots on public.face_landmark_consents;
create trigger face_consents_purge_snapshots
  after delete on public.face_landmark_consents
  for each row execute function public.purge_snapshots_on_consent_revoke();

revoke all on function public.lock_landmark_consent() from public, anon, authenticated;
revoke all on function public.purge_snapshots_on_consent_revoke() from public, anon, authenticated;

create or replace function public.set_landmark_consent(enabled boolean)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if enabled then
    insert into public.face_landmark_consents (user_id) values (auth.uid())
    on conflict (user_id) do nothing;
  else
    delete from public.face_landmark_consents where user_id = auth.uid();
  end if;
end;
$$;

revoke all on function public.set_landmark_consent(boolean) from public, anon;
grant execute on function public.set_landmark_consent(boolean) to authenticated;
