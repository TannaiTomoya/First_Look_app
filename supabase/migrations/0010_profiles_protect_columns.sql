-- profiles_update は列を絞っていないため、本人が role（管理者への自己昇格）や
-- stripe_customer_id（他人の課金ポータルを開ける）を書き換えられた。権限は docs/authorization.md の profiles に従う
-- ブラウザ経由（anon / authenticated）の変更だけを拒否し、service_role・管理用 SQL からの変更は通す

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.role is distinct from old.role
          or new.stripe_customer_id is distinct from old.stripe_customer_id) then
    raise exception 'role and stripe_customer_id cannot be changed by users' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_columns on public.profiles;
create trigger profiles_protect_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();
