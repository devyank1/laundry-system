begin;
select plan(22);

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
  ('00000000-0000-0000-0000-0000000000d1', 'cliente_fisico', null, false, true, 'cliente@team.pgtap.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'empresa', '20000000-0000-0000-0000-000000000002', true, true, 'outra@team.pgtap.local');

-- validação de CPF
select ok(is_valid_cpf('529.982.247-25'), 'CPF válido com máscara');
select ok(is_valid_cpf('52998224725'), 'CPF válido sem máscara');
select ok(not is_valid_cpf('111.111.111-11'), 'CPF com dígitos repetidos é inválido');
select ok(not is_valid_cpf('52998224726'), 'CPF com dígito verificador errado é inválido');

set local role authenticated;

-- vendedor 1 completa o cadastro
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select lives_ok($$ select complete_registration('Ana Lima', '529.982.247-25', '(11) 98765-4321', 'Vendedora', '00000000-0000-0000-0000-0000000000c1/photo') $$, 'vendedor completa o cadastro');
select results_eq(
  $$ select cpf, phone, registration_completed_at is not null from profiles where id = '00000000-0000-0000-0000-0000000000c1' $$,
  $$ values ('52998224725'::text, '11987654321'::text, true) $$,
  'CPF e telefone guardados só com dígitos e cadastro marcado como completo'
);
select is((select count(*)::int from profiles), 1, 'vendedor não lê perfil de colega direto');

-- validações
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select throws_ok($$ select complete_registration('Bia', '52998224726', '11912345678', 'Vendedora', '00000000-0000-0000-0000-0000000000f1/photo') $$, '22023', 'invalid_cpf', 'CPF inválido é recusado');
select throws_ok($$ select complete_registration('Bia', '111.444.777-35', '123', 'Vendedora', '00000000-0000-0000-0000-0000000000f1/photo') $$, '22023', 'invalid_phone', 'telefone inválido é recusado');
select throws_ok($$ select complete_registration('  ', '111.444.777-35', '11912345678', 'Vendedora', '00000000-0000-0000-0000-0000000000f1/photo') $$, '22023', 'missing_field', 'nome vazio é recusado');
select throws_ok($$ select complete_registration('Bia Souza', '529.982.247-25', '11912345678', 'Vendedora', '00000000-0000-0000-0000-0000000000f1/photo') $$, '23505', null, 'CPF de conta ativa não pode ser repetido');
select throws_ok($$ select complete_registration('Bia Souza', '111.444.777-35', '(11) 98765-4321', 'Vendedora', '00000000-0000-0000-0000-0000000000f1/photo') $$, '23505', null, 'telefone de conta ativa não pode ser repetido');

-- revogar libera o CPF
reset role;
update profiles set active = false where id = '00000000-0000-0000-0000-0000000000c1';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select lives_ok($$ select complete_registration('Bia Souza', '529.982.247-25', '11912345678', 'Vendedora', '00000000-0000-0000-0000-0000000000f1/photo') $$, 'CPF de conta revogada fica livre');
reset role;
update profiles set active = true, cpf = '11144477735' where id = '00000000-0000-0000-0000-0000000000c1';
set local role authenticated;

-- cliente físico não usa o cadastro
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select throws_ok($$ select complete_registration('Cli', '111.444.777-35', '11912345678', 'X', 'x/photo') $$, '42501', null, 'cliente físico não usa o cadastro de equipe');

-- vendedor edita contato; nome/CPF intocados; auditoria sem o valor
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
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
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select throws_ok($$ select update_my_contact('11955554444', 'Dono', 'x/photo') $$, '42501', null, 'edição exige cadastro completo');

-- company_team
select is((select cpf from company_team() where id = '00000000-0000-0000-0000-0000000000f1'), '52998224725', 'dono vê CPF do vendedor');
select is((select count(*)::int from company_team()), 3, 'dono vê só a própria equipe');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select results_eq(
  $$ select full_name, cpf, phone, photo_path, email from company_team() where id = '00000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('Bia Souza'::text, null::text, null::text, null::text, null::text) $$,
  'vendedor vê só nome e cargo do colega'
);
select isnt((select cpf from company_team() where id = '00000000-0000-0000-0000-0000000000c1'), null, 'vendedor vê os próprios dados');

select * from finish();
rollback;
