begin;
select plan(16);

-- v: vendedor (cadastro completo), n: vendedor sem cadastro, c: cliente físico, a: admin
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'admin@sess.pgtap.local'),
  ('00000000-0000-0000-0000-0000000005b1', 'vend@sess.pgtap.local'),
  ('00000000-0000-0000-0000-0000000005c1', 'novo@sess.pgtap.local'),
  ('00000000-0000-0000-0000-0000000005d1', 'cliente@sess.pgtap.local');
-- sessões do Auth (o login cria; created_at decide qual é a mais nova)
insert into auth.sessions (id, user_id, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000005b1', now() - interval '2 minutes'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000005b1', now() - interval '1 minute'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000005c1', now()),
  ('aaaaaaaa-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000005d1', now()),
  ('aaaaaaaa-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000005a1', now()),
  ('aaaaaaaa-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000005d1', now() - interval '10 minutes');
insert into companies (id, name) values ('30000000-0000-0000-0000-000000000001', 'Sessao A');
insert into catalog_machines (id, data) values ('s1', '{"id":"s1"}');
insert into company_machines values ('30000000-0000-0000-0000-000000000001', 's1');
insert into profiles (id, role, company_id, is_owner, active, registration_completed_at) values
  ('00000000-0000-0000-0000-0000000005a1', 'admin', null, false, true, null),
  ('00000000-0000-0000-0000-0000000005b1', 'empresa', '30000000-0000-0000-0000-000000000001', true, true, now()),
  ('00000000-0000-0000-0000-0000000005c1', 'empresa', '30000000-0000-0000-0000-000000000001', false, true, null),
  ('00000000-0000-0000-0000-0000000005d1', 'cliente_fisico', null, false, true, null);

set local role authenticated;

-- primeiro aparelho (S1)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005b1","session_id":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::int from catalog_machines), 0, 'sem sessão reivindicada não lê nada');
select lives_ok($$ select claim_session('ua1') $$, 'login reivindica a sessão');
select ok(session_is_current(), 'sessão recém-reivindicada é a atual');
select is((select count(*)::int from catalog_machines), 1, 'sessão atual lê catálogo');

-- segundo aparelho (S2) derruba o primeiro
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005b1","session_id":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$ select claim_session('ua2') $$, 'login em outro aparelho');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005b1","session_id":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(not session_is_current(), 'aparelho antigo deixa de ser a sessão atual');
select is((select count(*)::int from catalog_machines), 0, 'token antigo ainda válido não lê catálogo');
select throws_ok($$ select claim_session('ua1') $$, '42501', null, 'aparelho antigo não retoma a sessão');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005b1","session_id":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
select ok(session_is_current(), 'o aparelho novo continua sendo o atual');

-- vendedor sem cadastro, sessão válida
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005c1","session_id":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}';
select claim_session('ua3');
select is((select count(*)::int from catalog_machines), 0, 'empresa sem cadastro completo não lê catálogo');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005c1","session_id":"aaaaaaaa-0000-0000-0000-000000000009","role":"authenticated"}';
select throws_ok($$ select complete_registration('X', '529.982.247-25', '11987654321', 'Y', '00000000-0000-0000-0000-0000000005c1/photo') $$, '42501', null, 'cadastro com sessão antiga é recusado');

-- cliente físico não precisa de cadastro
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005d1","session_id":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}';
select claim_session('ua4');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005d1","session_id":"aaaaaaaa-0000-0000-0000-000000000006","role":"authenticated"}';
select throws_ok($$ select claim_session('ua6') $$, '42501', null, 'sessão criada há mais de 5 minutos não reivindica');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005d1","session_id":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*)::int from catalog_machines), 1, 'cliente físico com sessão lê catálogo sem cadastro');
select is((select count(*)::int from login_events), 0, 'usuário comum não lê o histórico de logins');
select throws_ok($$ select * from user_sessions $$, '42501', null, 'usuário comum não lê sessões');

-- admin vê o histórico com a derrubada
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a1","session_id":"aaaaaaaa-0000-0000-0000-000000000005","role":"authenticated"}';
select claim_session('ua5');
select ok(
  exists (select 1 from login_events where user_id = '00000000-0000-0000-0000-0000000005b1'
          and replaced_session_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_agent = 'ua2'),
  'admin vê login que derrubou o aparelho anterior'
);

select * from finish();
rollback;
