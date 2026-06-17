-- Blindagem de dados: esconde nome/telefone dos compradores e admin_emails
-- do acesso público (anon key). Rode no Supabase → SQL Editor.

-- =========================================================
-- 1) reservas: remover leitura pública direta
-- =========================================================
drop policy if exists "reservas_public_read" on reservas;

-- Admin logado (email em admin_emails) lê as reservas da sua rifa — para o painel.
drop policy if exists "reservas_admin_read" on reservas;
create policy "reservas_admin_read" on reservas
  for select to authenticated
  using (
    exists (
      select 1 from rifas r
      where r.id = reservas.rifa_id
        and lower(coalesce(auth.jwt() ->> 'email', '')) =
            any (array(select lower(x) from unnest(r.admin_emails) x))
    )
  );

-- (mantém reservas_public_insert: rifa pública precisa criar reservas)

-- =========================================================
-- 2) RPCs seguras (SECURITY DEFINER) — expõem só numero/status
-- =========================================================

-- Números ocupados da rifa (para montar a grade) — sem PII.
create or replace function numeros_ocupados(p_rifa_id uuid)
returns table(numero int, status text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select numero, status
  from reservas
  where rifa_id = p_rifa_id
    and status in ('reservado', 'pago')
  order by numero
$$;

revoke all on function numeros_ocupados(uuid) from public;
grant execute on function numeros_ocupados(uuid) to anon, authenticated;

-- "Ver meus números" — consulta pelo telefone (normalizado em dígitos).
create or replace function meus_numeros(p_rifa_id uuid, p_telefone text)
returns table(numero int, status text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select numero, status
  from reservas
  where rifa_id = p_rifa_id
    and telefone = regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g')
  order by numero
$$;

revoke all on function meus_numeros(uuid, text) from public;
grant execute on function meus_numeros(uuid, text) to anon, authenticated;

-- =========================================================
-- 3) rifas: esconder admin_emails do público (anon)
--    (authenticated mantém acesso total p/ o painel admin)
-- =========================================================
revoke select on rifas from anon;
grant select (
  id, title, description, total_numbers, start_number, price,
  draw_date, pix_type, pix_key, pix_name, pix_city, prizes, created_at
) on rifas to anon;
