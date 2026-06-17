-- Atualiza a rifa existente para a campanha do Juvenart 2026 (DTG Camboatá).
-- Rode no SQL Editor do Supabase se o banco já foi criado com a 001 antiga.

update rifas set
  title       = 'Rifa das Pilchas de Vinícius Prezzi Fleck - DTG Camboatá',
  description = 'Adquira seus números e ajude a continuar o sonho do Juvenart 2026.',
  price       = 5.00,
  pix_type    = 'CPF',
  pix_key     = '048.520.540-88',
  pix_name    = 'VINICIUS PREZZI FLECK',
  pix_city    = 'NOVO HAMBURGO',
  admin_emails = array['tjfleck@gmail.com', 'nenahprezzi@gmail.com', 'nenahprezzi01@gmail.com'];

-- Proteção contra reservas duplicadas: garante o índice único (rifa_id, numero).
-- A constraint já é criada na 001; este bloco é idempotente para bancos legados.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reservas_rifa_id_numero_key'
  ) then
    alter table reservas add constraint reservas_rifa_id_numero_key unique (rifa_id, numero);
  end if;
end $$;
