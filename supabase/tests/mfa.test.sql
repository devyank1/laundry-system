begin;
select plan(8);

-- a: admin; e: dono de empresa
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f0a1', 'admin@mfa.pgtap.local'),
  ('00000000-0000-0000-0000-00000000f0e1', 'dono@mfa.pgtap.local');
insert into companies (id, name) values ('40000000-0000-0000-0000-000000000001', 'MFA A');
insert into catalog_machines (id, data) values ('f1', '{"id":"f1"}');
insert into company_machines values ('40000000-0000-0000-0000-000000000001', 'f1');
insert into profiles (id, role, company_id, is_owner, active, registration_completed_at) values
  ('00000000-0000-0000-0000-00000000f0a1', 'admin', null, false, true, null),
  ('00000000-0000-0000-0000-00000000f0e1', 'empresa', '40000000-0000-0000-0000-000000000001', true, true, now());
insert into user_sessions (user_id, session_id) values
  ('00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-00000000f0a1'),
  ('00000000-0000-0000-0000-00000000f0e1', '00000000-0000-0000-0000-00000000f0e1');

set local role authenticated;

-- admin só com senha (aal1)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f0a1","session_id":"00000000-0000-0000-0000-00000000f0a1","aal":"aal1","role":"authenticated"}';
select is((select count(*)::int from current_profile()), 0, 'admin sem código do celular não tem papel');
select is((select count(*)::int from companies), 0, 'admin sem código do celular não lê empresas');
select throws_ok($$ insert into catalog_machines (id, data) values ('fx', '{}') $$, '42501', null, 'admin sem código do celular não escreve no catálogo');
select is((select role from profiles where id = '00000000-0000-0000-0000-00000000f0a1'), 'admin', 'admin sem código ainda lê o próprio perfil');

-- admin depois do código (aal2)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f0a1","session_id":"00000000-0000-0000-0000-00000000f0a1","aal":"aal2","role":"authenticated"}';
select is((select role from current_profile()), 'admin', 'admin com código do celular é admin');
select ok((select count(*)::int from companies) >= 1, 'admin com código do celular lê empresas');

-- empresa continua só com senha
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f0e1","session_id":"00000000-0000-0000-0000-00000000f0e1","aal":"aal1","role":"authenticated"}';
select is((select role from current_profile()), 'empresa', 'empresa não precisa de código');
select is((select count(*)::int from companies), 1, 'empresa lê a própria empresa só com senha');

select * from finish();
rollback;
