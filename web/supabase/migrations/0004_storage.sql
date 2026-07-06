-- =============================================================================
-- Storage — zayavka/hisobot rasmlari uchun 'photos' bucket
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Ko'rish: hamma o'qiy oladi (public bucket)
create policy "photos_public_read"
  on storage.objects for select
  using (bucket_id = 'photos');

-- Yuklash: faqat avtorizatsiyadan o'tganlar
create policy "photos_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos');

-- O'chirish: yuklagan foydalanuvchi
create policy "photos_owner_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and owner = auth.uid());
