-- Suporte a faixas múltiplas de numeração na mesma rifa.
alter table rifas
  add column if not exists number_ranges jsonb not null default '[]'::jsonb;

-- Backfill para rifas antigas que só possuem start_number + total_numbers.
update rifas
set number_ranges = jsonb_build_array(
  jsonb_build_object(
    'start', start_number,
    'end', start_number + total_numbers - 1
  )
)
where number_ranges = '[]'::jsonb
   or number_ranges is null;
