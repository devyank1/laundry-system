-- Toda edição do catálogo (feita pelo admin direto pelo client, via RLS)
-- entra na trilha de auditoria com autor e valores antigo/novo.
create or replace function public.log_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_actions_log (actor_id, action, details)
  values (
    auth.uid(),
    'catalog_' || lower(tg_op),
    jsonb_build_object(
      'id', coalesce(new.id, old.id),
      'old', case when tg_op in ('UPDATE', 'DELETE') then old.data end,
      'new', case when tg_op in ('INSERT', 'UPDATE') then new.data end
    )
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.log_catalog_change() from public, anon, authenticated;

create trigger catalog_machines_audit
  after insert or update or delete on public.catalog_machines
  for each row execute function public.log_catalog_change();
