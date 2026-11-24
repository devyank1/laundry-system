-- Admin só tem papel depois do código do celular (TOTP): o JWT precisa estar
-- em aal2. Sem isso current_profile() não devolve linha e toda policy de
-- admin nega. O próprio perfil continua legível ("profiles self read"),
-- que é como o app descobre que precisa pedir o código.
-- Empresa e cliente físico: sem mudança.
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
    and (p.role <> 'admin' or coalesce(auth.jwt() ->> 'aal', '') = 'aal2')
    and public.session_is_current()
$$;
