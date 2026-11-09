-- 権限は docs/authorization.md の coaches / daily_actions に従う
-- 1) coaches.verified（認証済み相談員）を変えられるのは管理者だけ。本人は未認証の行しか作れない
-- 2) daily_actions は管理者も閲覧のみ。更新・削除は本人だけ

create or replace function public.protect_coach_verified()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' and new.verified then
      raise exception 'only admins can verify coaches' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.verified is distinct from old.verified then
      raise exception 'only admins can verify coaches' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists coaches_protect_verified on public.coaches;
create trigger coaches_protect_verified
  before insert or update on public.coaches
  for each row execute function public.protect_coach_verified();

drop policy if exists "actions_all" on public.daily_actions;

drop policy if exists "actions_select" on public.daily_actions;
create policy "actions_select" on public.daily_actions
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

drop policy if exists "actions_insert" on public.daily_actions;
create policy "actions_insert" on public.daily_actions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "actions_update" on public.daily_actions;
create policy "actions_update" on public.daily_actions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "actions_delete" on public.daily_actions;
create policy "actions_delete" on public.daily_actions
  for delete to authenticated
  using ((select auth.uid()) = user_id);
