begin;
select plan(31);

-- a: admin, b: dono A, c: vendedor A, f: vendedor A (2), d: cliente físico, e: vendedor B
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@team.pgtap.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'dono@team.pgtap.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'vend1@team.pgtap.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'vend2@team.pgtap.local'),
  ('00000000-0000-0000-0000-0000000000d1', 'cliente@team.pgtap.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'outra@team.pgtap.local');
insert into companies (id, name) values
  ('20000000-0000-0000-0000-000000000001', 'Equipe A'),
  ('20000000-0000-0000-0000-000000000002', 'Equipe B');
insert into profiles (id, role, company_id, is_owner, active, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin', null, false, true, 'admin@team.pgtap.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'empresa', '20000000-0000-0000-0000-000000000001', true, true, 'dono@team.pgtap.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'empresa', '20000000-0000-0000-0000-000000000001', false, true, 'vend1@team.pgtap.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'empresa', '20000000-0000-0000-0000-000000000001', false, true, 'vend2@team.pgtap.local'),
  ('00000000-0000-0000-0000-0000000000d1', 'admin', null, false, true, 'cliente@team.pgtap.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'empresa', '20000000-0000-0000-0000-000000000002', true, true, 'outra@team.pgtap.local');

insert into user_sessions (user_id, session_id) select id, id from auth.users where email like '%pgtap.local';

-- validação de CPF
select ok(is_valid_cpf('529.982.247-25'), 'CPF válido com máscara');
select ok(is_valid_cpf('52998224725'), 'CPF válido sem máscara');
select ok(not is_valid_cpf('111.111.111-11'), 'CPF com dígitos repetidos é inválido');
select ok(not is_valid_cpf('52998224726'), 'CPF com dígito verificador errado é inválido');

set local role authenticated;

-- vendedor 1 completa o cadastro
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","session_id":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select throws_ok($$ select complete_registration('Ana Lima', '529.982.247-25', '(11) 98765-4321', 'Vendedora', '00000000-0000-0000-0000-0000000000c1/photo') $$, '22023', 'missing_field', 'cadastro exige a foto enviada de verdade');
reset role;
insert into storage.objects (bucket_id, name) values
  ('profile-photos', '00000000-0000-0000-0000-0000000000c1/photo'),
  ('profile-photos', '00000000-0000-0000-0000-0000000000f1/photo');
set local role authenticated;
select lives_ok($$ select complete_registration('Ana Lima', '529.982.247-25', '(11) 98765-4321', 'Vendedora', '00000000-0000-0000-0000-0000000000c1/photo') $$, 'vendedor completa o cadastro');
select results_eq(
  $$ select cpf, phone, registration_completed_at is not null from profiles where id = '00000000-0000-0000-0000-0000000000c1' $$,
  $$ values ('52998224725'::text, '11987654321'::text, true) $$,
  'CPF e telefone guardados só com dígitos e cadastro marcado como completo'
);
select is((select count(*)::int from profiles), 1, 'vendedor não lê perfil de colega direto');

-- validações
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","session_id":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select throws_ok($$ select complete_registration('Bia', '52998224726', '11912345678', 'Vendedora', '00000000-0000-0000-0000-0000000000f1/photo') $$, '22023', 'invalid_cpf', 'CPF inválido é recusado');
select throws_ok($$ select complete_registration('Bia', '111.444.777-35', '123', 'Vendedora', '00000000-0000-0000-0000-0000000000f1/photo') $$, '22023', 'invalid_phone', 'telefone inválido é recusado');
select throws_ok($$ select complete_registration('  ', '111.444.777-35', '11912345678', 'Vendedora', '00000000-0000-0000-0000-0000000000f1/photo') $$, '22023', 'missing_field', 'nome vazio é recusado');
select is(complete_registration('Bia Souza', '529.982.247-25', '11912345678', 'Vendedora', '00000000-0000-0000-0000-0000000000f1/photo'), 'cpf_taken', 'CPF de conta ativa não pode ser repetido');
select is(complete_registration('Bia Souza', '111.444.777-35', '(11) 98765-4321', 'Vendedora', '00000000-0000-0000-0000-0000000000f1/photo'), 'phone_taken', 'telefone de conta ativa não pode ser repetido');
reset role;
select ok(
  (select count(*) from admin_actions_log where action = 'registration_duplicate_rejected'
     and actor_id = '00000000-0000-0000-0000-0000000000f1'
     and details::text not like '%52998224725%' and details::text not like '%11987654321%') = 2
  and (select registration_completed_at from profiles where id = '00000000-0000-0000-0000-0000000000f1') is null,
  'tentativa com CPF/telefone repetido vai pra auditoria (sem os valores) e não completa o cadastro'
);
set local role authenticated;

-- revogar libera o CPF
reset role;
update profiles set active = false where id = '00000000-0000-0000-0000-0000000000c1';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","session_id":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select lives_ok($$ select complete_registration('Bia Souza', '529.982.247-25', '11912345678', 'Vendedora', '00000000-0000-0000-0000-0000000000f1/photo') $$, 'CPF de conta revogada fica livre');
reset role;
update profiles set active = true, cpf = '11144477735' where id = '00000000-0000-0000-0000-0000000000c1';
set local role authenticated;

-- admin não usa o cadastro de equipe
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","session_id":"00000000-0000-0000-0000-0000000000d1","aal":"aal2","role":"authenticated"}';
select throws_ok($$ select complete_registration('Cli', '111.444.777-35', '11912345678', 'X', 'x/photo') $$, '42501', null, 'admin não usa o cadastro de equipe');

-- vendedor edita contato; nome/CPF intocados; auditoria sem o valor
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","session_id":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select lives_ok($$ select update_my_contact('(21) 3456-7890', 'Gerente', '00000000-0000-0000-0000-0000000000f1/photo') $$, 'vendedor edita telefone e cargo');
select results_eq(
  $$ select full_name, cpf, phone, job_title from profiles where id = '00000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('Bia Souza'::text, '52998224725'::text, '2134567890'::text, 'Gerente'::text) $$,
  'nome e CPF não mudam pela edição de contato'
);
reset role;
select ok(
  exists (select 1 from admin_actions_log where action = 'profile_data_changed'
          and details->>'id' = '00000000-0000-0000-0000-0000000000f1'
          and details->'fields' ? 'phone'
          and details::text not like '%2134567890%'),
  'alteração de dados vai pra auditoria sem o valor'
);

-- dono sem cadastro não usa update_my_contact
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","session_id":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select throws_ok($$ select update_my_contact('11955554444', 'Dono', 'x/photo') $$, '42501', null, 'edição exige cadastro completo');

-- company_team
select is((select cpf from company_team() where id = '00000000-0000-0000-0000-0000000000f1'), '52998224725', 'dono vê CPF do vendedor');
select is((select count(*)::int from company_team()), 3, 'dono vê só a própria equipe');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","session_id":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select results_eq(
  $$ select full_name, cpf, phone, photo_path, email from company_team() where id = '00000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('Bia Souza'::text, null::text, null::text, null::text, null::text) $$,
  'vendedor vê só nome e cargo do colega'
);
select isnt((select cpf from company_team() where id = '00000000-0000-0000-0000-0000000000c1'), null, 'vendedor vê os próprios dados');

-- admin corrige nome/CPF; vendedor não altera direto
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","session_id":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
update profiles set cpf = '11144477735' where id = '00000000-0000-0000-0000-0000000000f1';
reset role;
select is((select cpf from profiles where id = '00000000-0000-0000-0000-0000000000f1'), '52998224725', 'vendedor não altera o próprio CPF direto');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","session_id":"00000000-0000-0000-0000-0000000000a1","aal":"aal2","role":"authenticated"}';
select lives_ok($$ update profiles set full_name = 'Bia Souza Lima', cpf = '22233366638' where id = '00000000-0000-0000-0000-0000000000f1' $$, 'admin corrige nome e CPF');
reset role;
select ok(
  exists (select 1 from admin_actions_log where action = 'profile_data_changed'
          and actor_id = '00000000-0000-0000-0000-0000000000a1'
          and details->>'id' = '00000000-0000-0000-0000-0000000000f1' and details->'fields' ? 'cpf'),
  'correção do admin vai pra auditoria com o autor'
);

-- fotos (bucket privado)
reset role;
insert into storage.objects (bucket_id, name) values
  ('profile-photos', '00000000-0000-0000-0000-0000000000e1/photo');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","session_id":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('profile-photos', '00000000-0000-0000-0000-0000000000c1/photo2') $$, '42501', null, 'ninguém grava na pasta de outra pessoa');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","session_id":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('profile-photos', '00000000-0000-0000-0000-0000000000b1/photo') $$, 'cada um grava a própria foto');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","session_id":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select is((select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-0000000000c1/photo'), 0, 'vendedor não vê foto do colega');
reset role;
update profiles set registration_completed_at = now() where id = '00000000-0000-0000-0000-0000000000b1';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","session_id":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select results_eq(
  $$ select name from storage.objects where bucket_id = 'profile-photos' order by name $$,
  $$ values ('00000000-0000-0000-0000-0000000000b1/photo'::text), ('00000000-0000-0000-0000-0000000000c1/photo'::text), ('00000000-0000-0000-0000-0000000000f1/photo'::text) $$,
  'dono vê as fotos da própria equipe e não as de outra empresa'
);

select * from finish();
rollback;
