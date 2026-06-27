-- ⚠️ RESET COMPLETO: apaga dados e estruturas existentes antes de recriar.
drop trigger if exists reservas_updated_at on reservas;
drop table if exists reservas cascade;
drop table if exists rifas cascade;
drop function if exists set_updated_at();

create extension if not exists "pgcrypto";

create table rifas (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  total_numbers int not null default 100,
  start_number  int not null default 1,
  number_ranges jsonb not null default '[]'::jsonb,
  price         numeric(10,2) not null default 10,
  draw_date     date,
  pix_type      text,
  pix_key       text,
  pix_name      text,
  pix_city      text default 'SAO PAULO',
  admin_emails  text[] not null default '{}',
  prizes        text[] not null default '{}',
  created_at    timestamptz default now()
);

create table reservas (
  id         uuid primary key default gen_random_uuid(),
  rifa_id    uuid references rifas(id) on delete cascade,
  numero     int not null,
  nome       text not null,
  telefone   text not null,
  status     text not null default 'reservado',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (rifa_id, numero)
);

create index reservas_rifa_idx on reservas(rifa_id, status);

alter table rifas    enable row level security;
alter table reservas enable row level security;

create policy "rifas_public_read"      on rifas    for select using (true);
create policy "reservas_public_read"   on reservas for select using (true);
create policy "reservas_public_insert" on reservas for insert with check (status = 'reservado');

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger reservas_updated_at
  before update on reservas
  for each row execute function set_updated_at();

insert into rifas (title, description, total_numbers, start_number, number_ranges, price, pix_type, pix_key, pix_name, pix_city, admin_emails, prizes)
values (
  'Rifa das Pilchas de Vinícius Prezzi Fleck - DTG Camboatá',
  'Adquira seus números e ajude a continuar o sonho do Juvenart 2026.',
  80,
  5521,
  jsonb_build_array(jsonb_build_object('start', 5521, 'end', 5600)),
  5.00,
  'CPF',
  '048.520.540-88',
  'VINICIUS PREZZI FLECK',
  'NOVO HAMBURGO',
  array['tjfleck@gmail.com', 'nenahprezzi@gmail.com', 'nenahprezzi01@gmail.com'],
  array[
    'Faca do Camboatá',
    'Bolsa de couro masculina',
    'Bolsa de couro feminina',
    'Camisa da Seleção Brasileira autografada pelo goleiro Weverton',
    'Barril de chopp 30 litros',
    'Troca de óleo + revisão de 40 itens',
    'Tábua de carne personalizada',
    'Kit ferramentas',
    'Processador de legumes',
    'Parafusadeira 12V',
    'Costelão Rota 77',
    'Armário 2 portas',
    'Bolsa de couro',
    'Jarra elétrica',
    'Miniatura 3D do estádio (Inter ou Grêmio)',
    'Liquidificador',
    'Jogo de cama casal',
    'Ferro de passar',
    'Kit Chimarrão Personalizado DTG Camboatá',
    'Kit Chimarrão (cuia, bomba e garrafa térmica)',
    'Kit Chimarrão',
    'Ofurô infantil',
    'Cantinho do Chima',
    'Avaliação física com nutri + adipômetro',
    'Massagem modeladora',
    'Aplicação de lipo enzimática',
    'Kit Banho/Spa',
    'Corte masculino Genuine House',
    'Corte masculino',
    'Corte masculino',
    'Corte masculino',
    'Manicure e Pedicure',
    'Bolsa térmica',
    'Cadeira de praia',
    'Cadeira de praia',
    'Tábua de carne',
    'Tábua de carne',
    'Tábua de carne',
    'Tábua de carne',
    'Faqueiro 24 peças',
    'Conjunto de sobremesa inox',
    'Mop giratório',
    'Kit nichos de parede',
    'Kit nichos de parede',
    'Organizador 12,5 litros',
    'Bacia dobrável',
    'Jarra 2 litros',
    '2 Travesseiros',
    'Cesta de guloseimas',
    'Cesta de guloseimas',
    'Cesta de doces',
    'Cuca de leite condensado e bombom',
    'Um cento de salgados',
    'Jogo de tapete',
    'Par de Alpargatas',
    'Bolsa Feminina',
    'Jarra Elétrica',
    'Jogo de cafézinho'
  ]
);

-- Garante os valores da campanha Juvenart 2026 (idempotente, mesmo em banco já populado).
update rifas set
  title        = 'Rifa das Pilchas de Vinícius Prezzi Fleck - DTG Camboatá',
  description  = 'Adquira seus números e ajude a continuar o sonho do Juvenart 2026.',
  number_ranges = coalesce(number_ranges, '[]'::jsonb),
  price        = 5.00,
  pix_type     = 'CPF',
  pix_key      = '048.520.540-88',
  pix_name     = 'VINICIUS PREZZI FLECK',
  pix_city     = 'NOVO HAMBURGO',
  admin_emails = array['tjfleck@gmail.com', 'nenahprezzi@gmail.com', 'nenahprezzi01@gmail.com'];
