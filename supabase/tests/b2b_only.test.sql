begin;
select plan(3);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000b2b1', 'pf@b2b.pgtap.local');
select throws_ok(
  $$ insert into profiles (id, role, active) values ('00000000-0000-0000-0000-00000000b2b1', 'cliente_fisico', true) $$,
  '23514', null, 'não existe mais conta de cliente físico (só B2B)'
);
select hasnt_table('public', 'cakto_processed_events', 'tabela de pedidos da Cakto removida');
select policies_are('public', 'catalog_machines', array['catalog admin all', 'catalog empresa read'], 'catálogo: só admin e empresa');

select * from finish();
rollback;
