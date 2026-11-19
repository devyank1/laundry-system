-- Sessão única por conta: o login (senha ou link) reivindica a sessão; a
-- partir daí só o session_id do JWT reivindicado passa pela RLS. Um token
-- antigo ainda dentro da validade deixa de ler na hora.
-- Também passa a exigir cadastro completo para contas de empresa.

create table public.user_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  updated_at timestamptz not null default now()
);

create table public.login_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  replaced_session_id uuid,
  ip text,
  user_agent text check (char_length(user_agent) <= 500),
  created_at timestamptz not null default now()
);

alter table public.user_sessions enable row level security;
alter table public.login_events enable row level security;
revoke all on public.user_sessions from anon, authenticated;
revoke all on public.login_events from anon;

create or replace function public.jwt_session_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid
$$;

create or replace function public.session_is_current()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.user_sessions s
    where s.user_id = auth.uid() and s.session_id = public.jwt_session_id()
  )
$$;

create or replace function public.claim_session(p_user_agent text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid := public.jwt_session_id();
  v_previous uuid;
  v_created timestamptz;
  v_previous_created timestamptz;
  v_ip text;
begin
  if auth.uid() is null or v_session is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- Só um login de verdade reivindica: a sessão do Auth tem que ter sido
  -- criada há pouco e ser mais nova que a atual. Assim um aparelho derrubado
  -- (token antigo ainda válido) não consegue tomar a sessão de volta.
  select s.created_at into v_created from auth.sessions s
  where s.id = v_session and s.user_id = auth.uid();
  if v_created is null or v_created < now() - interval '5 minutes' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select session_id into v_previous from public.user_sessions where user_id = auth.uid();
  if v_previous is not null and v_previous <> v_session then
    select s.created_at into v_previous_created from auth.sessions s where s.id = v_previous;
    if v_previous_created is not null and v_previous_created >= v_created then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;
  insert into public.user_sessions (user_id, session_id, updated_at)
  values (auth.uid(), v_session, now())
  on conflict (user_id) do update set session_id = excluded.session_id, updated_at = now();
  v_ip := btrim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1));
  insert into public.login_events (user_id, session_id, replaced_session_id, ip, user_agent)
  values (auth.uid(), v_session,
          case when v_previous is distinct from v_session then v_previous end,
          nullif(v_ip, ''), left(p_user_agent, 500));
end;
$$;

revoke all on function public.jwt_session_id() from public, anon;
revoke all on function public.session_is_current() from public, anon;
revoke all on function public.claim_session(text) from public, anon;
grant execute on function public.jwt_session_id() to authenticated;
grant execute on function public.session_is_current() to authenticated;
grant execute on function public.claim_session(text) to authenticated;

create policy "login_events admin read" on public.login_events for select to authenticated
  using ((select cp.role from public.current_profile() cp) = 'admin');

-- Base de toda RLS: perfil ativo + sessão atual + (empresa => cadastro completo).
create or replace function public.current_profile()
returns table(role text, company_id uuid, is_owner boolean)
language sql
security definer
stable
set search_path = public
as $$
  select p.role, p.company_id, p.is_owner
  from public.profiles p
  where p.id = auth.uid()
    and p.active = true
    and (p.role <> 'empresa' or p.registration_completed_at is not null)
    and public.session_is_current()
$$;

-- RPCs de cadastro/equipe também exigem a sessão atual.
create or replace function public.require_current_session()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.session_is_current() then
    raise exception 'session_replaced' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.require_current_session() from public, anon;
grant execute on function public.require_current_session() to authenticated;

-- Quem já estava logado antes desta migration não tem sessão reivindicada:
-- a sessão mais recente de cada conta vira a atual (as outras caem), pra
-- ninguém ser derrubado só por causa da publicação.
insert into public.user_sessions (user_id, session_id, updated_at)
select distinct on (s.user_id) s.user_id, s.id, now()
from auth.sessions s
order by s.user_id, s.created_at desc
on conflict (user_id) do nothing;
