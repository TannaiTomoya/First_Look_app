-- Storage バケットと RLS を確実に作成（SQL Editor で再実行可）

insert into storage.buckets (id, name, public)
values ('looks', 'looks', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "looks_storage_select" on storage.objects;
drop policy if exists "looks_storage_insert" on storage.objects;
drop policy if exists "looks_storage_delete" on storage.objects;
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_owner_write" on storage.objects;

create policy "looks_storage_select" on storage.objects for select
  to authenticated
  using (bucket_id = 'looks' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()));

create policy "looks_storage_insert" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'looks' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "looks_storage_delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'looks' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_owner_write" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
