begin;
select plan(32);

-- o: dono A, a1/a2: vendedores A, b: vendedor B, f: cliente físico
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007a0', 'dono@cli.pgtap.local'),
  ('00000000-0000-0000-0000-0000000007a1', 'a1@cli.pgtap.local'),
  ('00000000-0000-0000-0000-0000000007a2', 'a2@cli.pgtap.local'),
  ('00000000-0000-0000-0000-0000000007b1', 'b1@cli.pgtap.local'),
  ('00000000-0000-0000-0000-0000000007f1', 'f1@cli.pgtap.local');
insert into companies (id, name) values
  ('40000000-0000-0000-0000-00000000000a', 'Cli A'),
  ('40000000-0000-0000-0000-00000000000b', 'Cli B');
insert into profiles (id, role, company_id, is_owner, active, full_name, registration_completed_at) values
  ('00000000-0000-0000-0000-0000000007a0', 'empresa', '40000000-0000-0000-0000-00000000000a', true, true, 'Dono A', now()),
  ('00000000-0000-0000-0000-0000000007a1', 'empresa', '40000000-0000-0000-0000-00000000000a', false, true, 'Ana Um', now()),
  ('00000000-0000-0000-0000-0000000007a2', 'empresa', '40000000-0000-0000-0000-00000000000a', false, true, 'Carla Dois', now()),
  ('00000000-0000-0000-0000-0000000007b1', 'empresa', '40000000-0000-0000-0000-00000000000b', true, true, 'Beto B', now()),
  ('00000000-0000-0000-0000-0000000007f1', 'admin', null, false, true, null, null);
insert into user_sessions (user_id, session_id) select id, id from auth.users where email like '%cli.pgtap.local';

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

set local role authenticated;

-- vendedor A1 cria cliente
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007a1","session_id":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}';
select lives_ok($$
  with c as (insert into clients (company_id, seller_id, name, phone, cnpj)
             values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000007a1', 'Lava Já', '(11) 98765-4321', '11.222.333/0001-81') returning id)
  insert into ids select 'c1', id from c $$, 'vendedor cadastra cliente');
select is((select count(*)::int from clients), 1, 'vendedor lê o próprio cliente');
select results_eq($$ select phone, cnpj from clients $$, $$ values ('11987654321'::text, '11222333000181'::text) $$, 'telefone e CNPJ guardados só com dígitos');
select throws_ok($$ insert into clients (company_id, seller_id, name) values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000007a1', 'Sem contato') $$, '23514', null, 'cliente precisa de telefone ou email');
select throws_ok($$ insert into clients (company_id, seller_id, name, email, cnpj) values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000007a1', 'X', 'x@x.com', '11.111.111/1111-11') $$, '23514', null, 'CNPJ inválido é recusado');
select throws_ok($$ insert into clients (company_id, seller_id, name, email) values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000007a2', 'X', 'x@x.com') $$, '42501', null, 'vendedor não cadastra cliente em nome de colega');
select throws_ok($$ update clients set meeting = '{}' $$, '42501', null, 'reunião não é gravada por edição direta');
select lives_ok($$
  with c as (insert into clients (company_id, seller_id, name, email, meeting, meeting_saved_at, logo_path, created_at)
             values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000007a1', 'Forjado', 'f@f.com',
                     '{"x":1}', '2000-01-01', 'outra/empresa/logo', '2000-01-01') returning id)
  insert into ids select 'forjado', id from c $$, 'insert com campos de reunião não falha');
select ok((select meeting is null and meeting_saved_at is null and logo_path is null and created_at > now() - interval '1 minute'
           from clients where id = (select v from ids where k = 'forjado')),
          'insert não grava reunião, logo nem datas forjadas');
delete from clients where id = (select v from ids where k = 'forjado');
select lives_ok($$ select save_client_meeting((select v from ids where k = 'c1'), '{"v":1}', null) $$, 'responsável salva a reunião');
select isnt((select meeting_saved_at from clients), null, 'data da reunião registrada');
select throws_ok($$ select save_client_meeting((select v from ids where k = 'c1'), '{"v":1}', 'outra/coisa/logo') $$, '42501', null, 'caminho de logo fora do padrão é recusado');
select throws_ok($$ update clients set seller_id = '00000000-0000-0000-0000-0000000007a2' $$, '42501', null, 'vendedor não troca o responsável');
select lives_ok($$ update clients set notes = 'quer 2 lavadoras' $$, 'vendedor edita o próprio cliente');

-- logo
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('client-logos', '40000000-0000-0000-0000-00000000000a/%s/logo') $$, (select v from ids where k = 'c1')), 'responsável grava a logo do cliente');

-- colega A2
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007a2","session_id":"00000000-0000-0000-0000-0000000007a2","role":"authenticated"}';
select is((select count(*)::int from clients), 0, 'colega não vê cliente do outro vendedor');
select is((select count(*)::int from storage.objects where bucket_id = 'client-logos'), 0, 'colega não vê a logo');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('client-logos', '40000000-0000-0000-0000-00000000000a/%s/logo2') $$, (select v from ids where k = 'c1')), '42501', null, 'colega não grava na pasta do cliente do outro');
select is(client_duplicate_owner('11222333000181', null, null), 'Ana Um', 'duplicado por CNPJ devolve só o nome do responsável');
select is(client_duplicate_owner(null, '(11) 98765-4321', null), 'Ana Um', 'duplicado por telefone com máscara');

-- A1 vê o próprio como 'você'
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007a1","session_id":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}';
select is(client_duplicate_owner('11.222.333/0001-81', null, null), 'você', 'duplicado do próprio vendedor');

-- outra empresa
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007b1","session_id":"00000000-0000-0000-0000-0000000007b1","role":"authenticated"}';
select is((select count(*)::int from clients), 0, 'outra empresa não vê');
select is(client_duplicate_owner('11222333000181', null, null), null, 'duplicado não atravessa empresas');

-- admin não cadastra cliente em nome de vendedor
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007f1","session_id":"00000000-0000-0000-0000-0000000007f1","aal":"aal2","role":"authenticated"}';
select throws_ok($$ insert into clients (company_id, seller_id, name, email) values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000007f1', 'X', 'x@x.com') $$, '42501', null, 'admin não cadastra cliente em nome de vendedor');

-- dono
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000007a0","session_id":"00000000-0000-0000-0000-0000000007a0","role":"authenticated"}';
select is((select count(*)::int from clients), 1, 'dono vê os clientes da equipe');
select is((select count(*)::int from storage.objects where bucket_id = 'client-logos'), 1, 'dono vê a logo');
select throws_ok($$ select save_client_meeting((select v from ids where k = 'c1'), '{"v":1}', null) $$, '42501', null, 'dono não salva por cima da reunião do vendedor');
select lives_ok($$ update clients set seller_id = '00000000-0000-0000-0000-0000000007a2' $$, 'dono transfere o cliente');
reset role;
update profiles set active = false where id = '00000000-0000-0000-0000-0000000007a2';
set local role authenticated;
select lives_ok($$ update clients set seller_id = '00000000-0000-0000-0000-0000000007a1' $$, 'dono transfere cliente de vendedor revogado de volta');
select throws_ok($$ update clients set seller_id = '00000000-0000-0000-0000-0000000007a2' $$, '42501', null, 'não transfere pra vendedor revogado');
select throws_ok($$ update clients set seller_id = '00000000-0000-0000-0000-0000000007b1' $$, '42501', null, 'não transfere pra outra empresa');
delete from clients;
reset role;
select ok(
  exists (select 1 from admin_actions_log where action = 'client_deleted'
          and details->>'id' = (select v::text from ids where k = 'c1') and details::text not like '%Lava Já%'),
  'exclusão auditada sem dados do cliente'
);

select * from finish();
rollback;
