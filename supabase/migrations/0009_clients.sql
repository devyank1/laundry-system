-- Clientes (leads) das empresas parceiras e a reunião salva de cada um.
-- Vendedor vê, edita e exclui os próprios; dono vê, edita, transfere e
-- exclui os da empresa. Só o responsável grava a reunião (via save_client_meeting).
-- Tudo atrás de current_profile(): sessão única + cadastro completo.

create or replace function public.is_valid_cnpj(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int;
  r int;
  i int;
begin
  if length(d) <> 14 or d ~ '^(.)\1{13}$' then
    return false;
  end if;
  s := 0;
  for i in 1..12 loop s := s + substr(d, i, 1)::int * w1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> substr(d, 13, 1)::int then return false; end if;
  s := 0;
  for i in 1..13 loop s := s + substr(d, i, 1)::int * w2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = substr(d, 14, 1)::int;
end;
$$;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  seller_id uuid not null references public.profiles(id),
  name text not null check (btrim(name) <> '' and char_length(name) <= 200),
  phone text check (phone ~ '^[0-9]{10,11}$'),
  email text check (char_length(email) <= 200),
  cnpj text check (cnpj is null or public.is_valid_cnpj(cnpj)),
  has_location boolean not null default false,
  address text check (char_length(address) <= 500),
  location_m2 numeric check (location_m2 > 0),
  notes text check (char_length(notes) <= 5000),
  meeting jsonb,
  meeting_saved_at timestamptz,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_contact check (phone is not null or nullif(btrim(email), '') is not null)
);
create index clients_company_idx on public.clients(company_id);
create index clients_company_cnpj_idx on public.clients(company_id, cnpj);
create index clients_company_phone_idx on public.clients(company_id, phone);

alter table public.clients enable row level security;
revoke all on public.clients from anon;
revoke update on public.clients from authenticated;
grant select, insert, delete on public.clients to authenticated;
grant update (name, phone, email, cnpj, has_location, address, location_m2, notes, seller_id) on public.clients to authenticated;

create policy "clients read" on public.clients for select to authenticated
  using (exists (select 1 from public.current_profile() cp
                 where cp.role = 'empresa' and cp.company_id = clients.company_id
                   and (cp.is_owner or clients.seller_id = (select auth.uid()))));
create policy "clients insert" on public.clients for insert to authenticated
  with check (seller_id = (select auth.uid())
              and exists (select 1 from public.current_profile() cp
                          where cp.role = 'empresa' and cp.company_id = clients.company_id));
create policy "clients update" on public.clients for update to authenticated
  using (exists (select 1 from public.current_profile() cp
                 where cp.role = 'empresa' and cp.company_id = clients.company_id
                   and (cp.is_owner or clients.seller_id = (select auth.uid()))))
  with check (exists (select 1 from public.current_profile() cp
                      where cp.role = 'empresa' and cp.company_id = clients.company_id));
create policy "clients delete" on public.clients for delete to authenticated
  using (exists (select 1 from public.current_profile() cp
                 where cp.role = 'empresa' and cp.company_id = clients.company_id
                   and (cp.is_owner or clients.seller_id = (select auth.uid()))));

-- Normaliza contato; protege empresa e responsável.
create or replace function public.clients_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.phone := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
  new.cnpj := nullif(regexp_replace(coalesce(new.cnpj, ''), '[^0-9]', '', 'g'), '');
  new.email := nullif(btrim(coalesce(new.email, '')), '');
  if tg_op = 'INSERT' then
    -- reunião e logo só entram por save_client_meeting; datas são do servidor
    new.meeting := null;
    new.meeting_saved_at := null;
    new.logo_path := null;
    new.created_at := now();
    new.updated_at := now();
  end if;
  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    if new.seller_id is distinct from old.seller_id then
      -- só o dono troca o responsável, e só pra membro ativo da empresa
      if auth.uid() is not null and not exists (
           select 1 from public.profiles me
           where me.id = auth.uid() and me.active and me.is_owner and me.company_id = old.company_id)
         or not exists (
           select 1 from public.profiles p
           where p.id = new.seller_id and p.active and p.role = 'empresa' and p.company_id = old.company_id) then
        raise exception 'not_allowed' using errcode = '42501';
      end if;
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.clients_guard() from public, anon, authenticated;
create trigger clients_guard before insert or update on public.clients
  for each row execute function public.clients_guard();

create or replace function public.log_client_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_actions_log (actor_id, action, details)
  values (auth.uid(), 'client_deleted', jsonb_build_object('id', old.id, 'company_id', old.company_id));
  return old;
end;
$$;
revoke all on function public.log_client_deleted() from public, anon, authenticated;
create trigger clients_deleted_audit after delete on public.clients
  for each row execute function public.log_client_deleted();

-- Reunião: só o responsável, com a sessão atual.
create or replace function public.save_client_meeting(p_client uuid, p_meeting jsonb, p_logo_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clients;
begin
  perform public.require_current_session();
  select cl.* into c from public.clients cl
  join public.current_profile() cp on cp.role = 'empresa' and cp.company_id = cl.company_id
  where cl.id = p_client and cl.seller_id = auth.uid();
  if c.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_logo_path is not null and p_logo_path <> c.company_id::text || '/' || c.id::text || '/logo' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if octet_length(p_meeting::text) > 200000 then
    raise exception 'meeting_too_large' using errcode = '22023';
  end if;
  update public.clients set meeting = p_meeting, meeting_saved_at = now(), logo_path = p_logo_path, updated_at = now()
  where id = c.id;
end;
$$;

-- Cliente repetido na empresa: devolve só o nome do responsável.
create or replace function public.client_duplicate_owner(p_cnpj text, p_phone text, p_exclude uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select case when cl.seller_id = auth.uid() then 'você' else coalesce(p.full_name, 'um colega') end
  from public.clients cl
  join public.current_profile() cp on cp.role = 'empresa' and cp.company_id = cl.company_id
  join public.profiles p on p.id = cl.seller_id
  where (p_exclude is null or cl.id <> p_exclude)
    and ((nullif(regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g'), '') is not null
          and cl.cnpj = regexp_replace(p_cnpj, '[^0-9]', '', 'g'))
      or (nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '') is not null
          and cl.phone = regexp_replace(p_phone, '[^0-9]', '', 'g')))
  order by cl.created_at
  limit 1
$$;

revoke all on function public.save_client_meeting(uuid, jsonb, text) from public, anon;
revoke all on function public.client_duplicate_owner(text, text, uuid) from public, anon;
grant execute on function public.save_client_meeting(uuid, jsonb, text) to authenticated;
grant execute on function public.client_duplicate_owner(text, text, uuid) to authenticated;
grant execute on function public.is_valid_cnpj(text) to authenticated;

-- Logos dos clientes: <company_id>/<client_id>/logo, bucket privado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-logos', 'client-logos', false, 2097152, array['image/webp', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.client_logo_access(p_name text, p_write boolean)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.clients cl
    join public.current_profile() cp on cp.role = 'empresa' and cp.company_id = cl.company_id
    where p_name = cl.company_id::text || '/' || cl.id::text || '/logo'
      and (case when p_write then cl.seller_id = auth.uid()
                else cp.is_owner or cl.seller_id = auth.uid() end)
  )
$$;
revoke all on function public.client_logo_access(text, boolean) from public, anon;
grant execute on function public.client_logo_access(text, boolean) to authenticated;

create policy "client logos read" on storage.objects for select to authenticated
  using (bucket_id = 'client-logos' and public.client_logo_access(name, false));
create policy "client logos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-logos' and public.client_logo_access(name, true));
create policy "client logos update" on storage.objects for update to authenticated
  using (bucket_id = 'client-logos' and public.client_logo_access(name, true))
  with check (bucket_id = 'client-logos' and public.client_logo_access(name, true));
create policy "client logos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'client-logos' and public.client_logo_access(name, false));
