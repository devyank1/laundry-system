-- Fotos da equipe: bucket privado, só imagem, até 2 MB. Caminho
-- "<user_id>/photo". Cada pessoa grava/lê a própria (já antes de completar
-- o cadastro, que exige a foto); o dono lê as da própria empresa; o admin lê
-- todas. Colegas não-donos e outras empresas não leem.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_profile_photo(p_owner text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.session_is_current() and (
    p_owner = auth.uid()::text
    or exists (select 1 from public.current_profile() cp where cp.role = 'admin')
    or exists (
      select 1 from public.current_profile() cp
      join public.profiles p on p.company_id = cp.company_id
      where cp.role = 'empresa' and cp.is_owner and p.id::text = p_owner
    )
  )
$$;
revoke all on function public.can_read_profile_photo(text) from public, anon;
grant execute on function public.can_read_profile_photo(text) to authenticated;

create policy "profile photos read" on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos' and public.can_read_profile_photo((storage.foldername(name))[1]));
create policy "profile photos own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and name = auth.uid()::text || '/photo' and public.session_is_current());
create policy "profile photos own update" on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and name = auth.uid()::text || '/photo' and public.session_is_current())
  with check (bucket_id = 'profile-photos' and name = auth.uid()::text || '/photo');
