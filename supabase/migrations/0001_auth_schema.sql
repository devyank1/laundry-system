-- Login, papéis e segurança: empresas, perfis, catálogo e auditoria.
-- Toda tabela tem RLS ligado; sem policy explícita = acesso negado.
-- Escritas privilegiadas (criar usuário, empresa, convite) acontecem só em
-- Edge Functions com a chave service_role, que ignora RLS.

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'empresa', 'cliente_fisico')),
  company_id uuid references companies(id),
  is_owner boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- empresa sempre tem company_id; admin/cliente_fisico nunca têm.
  constraint profiles_company_matches_role check (
    (role = 'empresa' and company_id is not null)
    or (role <> 'empresa' and company_id is null and is_owner = false)
  )
);

create index profiles_company_id_idx on profiles(company_id);

create table catalog_machines (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table company_machines (
  company_id uuid not null references companies(id) on delete cascade,
  catalog_machine_id text not null references catalog_machines(id) on delete cascade,
  primary key (company_id, catalog_machine_id)
);

create table cakto_processed_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

create table admin_actions_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create table client_errors (
  id bigserial primary key,
  user_id uuid,
  message text not null check (char_length(message) <= 2000),
  stack text check (char_length(stack) <= 10000),
  created_at timestamptz not null default now()
);

-- current_profile(): único ponto de leitura de papel/empresa do usuário
-- logado. SECURITY DEFINER pra não recair na RLS de `profiles` dentro da
-- própria policy de `profiles`; search_path fixo pra não ser sequestrado.
-- Perfil inativo (colega revogado) devolve zero linhas e toda policy nega.
create or replace function public.current_profile()
returns table(role text, company_id uuid, is_owner boolean)
language sql
security definer
stable
set search_path = public
as $$
  select p.role, p.company_id, p.is_owner
  from public.profiles p
  where p.id = auth.uid() and p.active = true
$$;

revoke all on function public.current_profile() from public, anon;
grant execute on function public.current_profile() to authenticated;

alter table profiles enable row level security;
alter table companies enable row level security;
alter table company_machines enable row level security;
alter table catalog_machines enable row level security;
alter table cakto_processed_events enable row level security;
alter table admin_actions_log enable row level security;
alter table client_errors enable row level security;

-- Visitante anônimo não lê nada destas tabelas.
revoke all on profiles, companies, company_machines, catalog_machines,
  cakto_processed_events, admin_actions_log, client_errors from anon;
-- Usuário logado nunca toca nas tabelas internas das Edge Functions.
revoke all on cakto_processed_events from authenticated;

-- profiles: cada um lê o próprio; empresa lê os colegas da própria empresa;
-- admin lê e escreve tudo. Ninguém além do admin altera perfis pelo client
-- (convite/revogação passam pelas Edge Functions).
create policy "profiles self read" on profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles same company read" on profiles for select to authenticated
  using (
    (select cp.role from current_profile() cp) = 'empresa'
    and company_id = (select cp.company_id from current_profile() cp)
  );
create policy "profiles admin all" on profiles for all to authenticated
  using ((select cp.role from current_profile() cp) = 'admin')
  with check ((select cp.role from current_profile() cp) = 'admin');

-- companies: admin tudo; empresa lê só a própria.
create policy "companies admin all" on companies for all to authenticated
  using ((select cp.role from current_profile() cp) = 'admin')
  with check ((select cp.role from current_profile() cp) = 'admin');
create policy "companies own read" on companies for select to authenticated
  using (id = (select cp.company_id from current_profile() cp));

-- company_machines: admin tudo; empresa lê só a própria.
create policy "company_machines admin all" on company_machines for all to authenticated
  using ((select cp.role from current_profile() cp) = 'admin')
  with check ((select cp.role from current_profile() cp) = 'admin');
create policy "company_machines own read" on company_machines for select to authenticated
  using (company_id = (select cp.company_id from current_profile() cp));

-- catalog_machines: só admin escreve; admin/cliente_fisico leem tudo;
-- empresa lê só o subconjunto liberado em company_machines.
create policy "catalog admin all" on catalog_machines for all to authenticated
  using ((select cp.role from current_profile() cp) = 'admin')
  with check ((select cp.role from current_profile() cp) = 'admin');
create policy "catalog full read" on catalog_machines for select to authenticated
  using ((select cp.role from current_profile() cp) in ('admin', 'cliente_fisico'));
create policy "catalog empresa read" on catalog_machines for select to authenticated
  using (
    (select cp.role from current_profile() cp) = 'empresa'
    and id in (
      select cm.catalog_machine_id from company_machines cm
      where cm.company_id = (select cp.company_id from current_profile() cp)
    )
  );

-- admin_actions_log: só Edge Functions escrevem (service_role); admin lê.
create policy "admin_actions_log admin read" on admin_actions_log for select to authenticated
  using ((select cp.role from current_profile() cp) = 'admin');

-- client_errors: usuário ativo insere o próprio erro; admin lê tudo.
create policy "client_errors self insert" on client_errors for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from current_profile()));
create policy "client_errors admin read" on client_errors for select to authenticated
  using ((select cp.role from current_profile() cp) = 'admin');
