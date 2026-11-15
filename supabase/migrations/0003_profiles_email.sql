-- Email no perfil pra empresa listar a própria equipe (a RLS de profiles já
-- limita a leitura à mesma empresa). Preenchido pelas Edge Functions.
alter table profiles add column email text;

update profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;
