-- Edge Functions precisam saber se um email já tem conta ANTES de convidar:
-- generateLink(invite) com email já convidado devolve o usuário existente
-- (não dá erro), e tratar isso como "novo" levaria a apagar a conta dos
-- outros num rollback. Só service_role executa (ninguém enumera emails).
create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1
$$;

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
