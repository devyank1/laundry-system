-- Só B2B: não existe mais conta de cliente físico nem venda pela Cakto.
-- (Na nuvem não havia nenhum perfil cliente_fisico nem pedido da Cakto.)

-- Leitura do catálogo inteiro era pra admin e cliente físico; admin já lê
-- tudo pela "catalog admin all".
drop policy if exists "catalog full read" on public.catalog_machines;

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'empresa'));

drop table if exists public.cakto_processed_events;
