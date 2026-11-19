-- Cadastro completo da equipe (dono e vendedores das empresas): nome,
-- CPF, telefone, cargo e foto. CPF e telefone são únicos entre contas
-- ativas; revogar a conta libera os dois. A equipe é lida só pela função
-- company_team(), que esconde CPF/telefone/foto dos colegas não-donos.

alter table public.profiles
  add column full_name text,
  add column cpf text check (cpf ~ '^[0-9]{11}$'),
  add column phone text check (phone ~ '^[0-9]{10,11}$'),
  add column job_title text,
  add column photo_path text,
  add column registration_completed_at timestamptz;

create unique index profiles_cpf_active_uniq on public.profiles(cpf) where active and cpf is not null;
create unique index profiles_phone_active_uniq on public.profiles(phone) where active and phone is not null;

-- Dígitos verificadores do CPF; aceita com ou sem máscara.
create or replace function public.is_valid_cpf(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
  s int;
  r int;
  i int;
begin
  if length(d) <> 11 or d ~ '^(.)\1{10}$' then
    return false;
  end if;
  s := 0;
  for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::int then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = substr(d, 11, 1)::int;
end;
$$;

-- Telefone BR com DDD (11–99), 10 ou 11 dígitos; devolve só dígitos ou null.
create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^[1-9][1-9][0-9]{8,9}$' then d
    else null
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x
$$;

create or replace function public.complete_registration(
  p_full_name text, p_cpf text, p_phone text, p_job_title text, p_photo_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles;
  v_phone text;
begin
  -- definida em 0007 (sessão única); resolvida em tempo de execução.
  perform public.require_current_session();
  select * into me from public.profiles where id = auth.uid() and active;
  if me.id is null or me.role <> 'empresa' or me.registration_completed_at is not null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if coalesce(btrim(p_full_name), '') = '' or coalesce(btrim(p_job_title), '') = ''
     or coalesce(p_photo_path, '') <> auth.uid()::text || '/photo' then
    raise exception 'missing_field' using errcode = '22023';
  end if;
  if not public.is_valid_cpf(p_cpf) then
    raise exception 'invalid_cpf' using errcode = '22023';
  end if;
  v_phone := public.normalize_phone(p_phone);
  if v_phone is null then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  update public.profiles set
    full_name = btrim(p_full_name),
    cpf = regexp_replace(p_cpf, '[^0-9]', '', 'g'),
    phone = v_phone,
    job_title = btrim(p_job_title),
    photo_path = p_photo_path,
    registration_completed_at = now()
  where id = me.id;
end;
$$;

-- Depois do cadastro: telefone, cargo e foto. Nome e CPF só o admin corrige.
create or replace function public.update_my_contact(p_phone text, p_job_title text, p_photo_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles;
  v_phone text;
begin
  -- definida em 0007 (sessão única); resolvida em tempo de execução.
  perform public.require_current_session();
  select * into me from public.profiles where id = auth.uid() and active;
  if me.id is null or me.role <> 'empresa' or me.registration_completed_at is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if coalesce(btrim(p_job_title), '') = '' or coalesce(p_photo_path, '') <> auth.uid()::text || '/photo' then
    raise exception 'missing_field' using errcode = '22023';
  end if;
  v_phone := public.normalize_phone(p_phone);
  if v_phone is null then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  update public.profiles set phone = v_phone, job_title = btrim(p_job_title), photo_path = p_photo_path
  where id = me.id;
end;
$$;

-- Equipe da empresa do chamador. Dono vê tudo; os demais veem só nome e
-- cargo dos colegas (os próprios dados completos).
create or replace function public.company_team()
returns table(id uuid, full_name text, job_title text, is_owner boolean, active boolean,
              registered boolean, email text, cpf text, phone text, photo_path text)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  perform public.require_current_session();
  return query
  with me as (
    select p.id, p.company_id, p.is_owner from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'empresa'
  )
  select p.id, p.full_name, p.job_title, p.is_owner, p.active,
         p.registration_completed_at is not null,
         case when me.is_owner or p.id = me.id then p.email end,
         case when me.is_owner or p.id = me.id then p.cpf end,
         case when me.is_owner or p.id = me.id then p.phone end,
         case when me.is_owner or p.id = me.id then p.photo_path end
  from public.profiles p join me on p.company_id = me.company_id
  order by p.is_owner desc, p.full_name nulls last, p.email;
end;
$$;

revoke all on function public.complete_registration(text, text, text, text, text) from public, anon;
revoke all on function public.update_my_contact(text, text, text) from public, anon;
revoke all on function public.company_team() from public, anon;
grant execute on function public.complete_registration(text, text, text, text, text) to authenticated;
grant execute on function public.update_my_contact(text, text, text) to authenticated;
grant execute on function public.company_team() to authenticated;

-- Equipe passa a vir só por company_team().
drop policy "profiles same company read" on public.profiles;

-- Auditoria de dados cadastrais: registra quem mudou e quais campos, sem
-- gravar os valores (CPF/telefone são dados pessoais).
create or replace function public.log_profile_data_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
begin
  if new.full_name is distinct from old.full_name then changed := array_append(changed, 'full_name'); end if;
  if new.cpf is distinct from old.cpf then changed := array_append(changed, 'cpf'); end if;
  if new.phone is distinct from old.phone then changed := array_append(changed, 'phone'); end if;
  if new.job_title is distinct from old.job_title then changed := array_append(changed, 'job_title'); end if;
  if new.photo_path is distinct from old.photo_path then changed := array_append(changed, 'photo_path'); end if;
  if cardinality(changed) > 0 then
    insert into public.admin_actions_log (actor_id, action, details)
    values (auth.uid(), 'profile_data_changed', jsonb_build_object('id', new.id, 'fields', to_jsonb(changed)));
  end if;
  return new;
end;
$$;

revoke all on function public.log_profile_data_change() from public, anon, authenticated;

create trigger profiles_registration_audit
  after update on public.profiles
  for each row execute function public.log_profile_data_change();
