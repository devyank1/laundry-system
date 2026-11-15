begin;
select plan(13);

-- Usuários de teste
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'dono@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'colega@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'cliente@test.local'),
  ('00000000-0000-0000-0000-00000000000e', 'outra@test.local');

insert into companies (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Empresa A'),
  ('10000000-0000-0000-0000-000000000002', 'Empresa B');

insert into catalog_machines (id, data) values
  ('m1', '{"id":"m1"}'), ('m2', '{"id":"m2"}'), ('m3', '{"id":"m3"}');

insert into company_machines values
  ('10000000-0000-0000-0000-000000000001', 'm1'),
  ('10000000-0000-0000-0000-000000000002', 'm2');

insert into profiles (id, role, company_id, is_owner, active) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', null, false, true),
  ('00000000-0000-0000-0000-00000000000b', 'empresa', '10000000-0000-0000-0000-000000000001', true, true),
  ('00000000-0000-0000-0000-00000000000c', 'empresa', '10000000-0000-0000-0000-000000000001', false, false),
  ('00000000-0000-0000-0000-00000000000d', 'cliente_fisico', null, false, true),
  ('00000000-0000-0000-0000-00000000000e', 'empresa', '10000000-0000-0000-0000-000000000002', true, true);

-- anon
set local role anon;
select throws_ok($$ select count(*) from catalog_machines $$, '42501', null, 'anon não lê catálogo');

-- admin
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((select count(*)::int from catalog_machines), 3, 'admin lê catálogo completo');
select lives_ok($$ insert into catalog_machines (id, data) values ('m4', '{"id":"m4"}') $$, 'admin escreve no catálogo');
select is((select count(*)::int from profiles), 5, 'admin lê todos os perfis');

-- dono da empresa A
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select results_eq($$ select id from catalog_machines order by id $$, $$ values ('m1') $$, 'empresa vê só o catálogo liberado');
select throws_ok($$ insert into catalog_machines (id, data) values ('x', '{}') $$, '42501', null, 'empresa não escreve no catálogo');
select is((select count(*)::int from profiles), 2, 'empresa vê só perfis da própria empresa');
select is((select count(*)::int from companies), 1, 'empresa vê só a própria empresa');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000b';
select is((select role from current_profile()), 'empresa', 'empresa não se promove a admin');

-- colega revogado (active=false), com sessão ainda válida
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select is((select count(*)::int from catalog_machines), 0, 'colega revogado não lê catálogo');
select is((select count(*)::int from companies), 0, 'colega revogado não lê empresa');

-- cliente físico
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}';
select is((select count(*)::int from catalog_machines), 4, 'cliente físico lê catálogo completo');
select throws_ok($$ select * from cakto_processed_events $$, '42501', null, 'cliente físico não lê eventos da Cakto');

select * from finish();
rollback;
