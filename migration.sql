-- =============================================================================
-- Camboatá App — Database Migration
-- Schema: English throughout (tables, columns, role names)
-- Run once in Supabase › SQL Editor
-- =============================================================================

create extension if not exists "uuid-ossp";


-- =============================================================================
-- 1. ROLES
-- =============================================================================

create table if not exists roles (
  id          uuid    primary key default uuid_generate_v4(),
  name        text    not null unique,
  description text,
  created_at  timestamptz default now()
);

-- Seed roles (idempotent)
insert into roles (name, description) values
  ('super',          'Full system access — users, settings, logs, all modules')
 ,('board',          'Board: dancers, cashier, dashboard, history, birthdays')
 ,('coordination',   'Coordination: register dancers, organise dinners, dashboard')
 ,('secretariat',    'Secretariat: same permissions as coordination')
 ,('kitchen',        'Kitchen staff: dinner tab and calendar only')
 ,('treasury',       'Treasury: cashier and financial dashboard')
 ,('organizer',      'Dinner organiser: edit menu, log expense for own dinners')
 ,('guardian',       'Parent/Guardian: confirm attendance, view calendar and orders')
on conflict (name) do nothing;


-- =============================================================================
-- 2. USER ROLES  (links auth.users ↔ roles)
-- =============================================================================

create table if not exists user_roles (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role_id    uuid not null references roles(id)      on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, role_id)
);

alter table user_roles enable row level security;

create policy if not exists "Users can read their own role"
  on user_roles for select
  using (auth.uid() = user_id);

create policy if not exists "Super users can manage all roles"
  on user_roles for all
  using (
    exists (
      select 1 from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = auth.uid() and r.name = 'super'
    )
  );


-- =============================================================================
-- 3. DANCERS
-- =============================================================================

create table if not exists dancers (
  id              uuid        primary key default uuid_generate_v4(),
  name            text        not null,
  birth_date      date,
  phone           text,
  group_name      text,               -- primary group: 'Pre-mirim'|'Mirim'|'Juvenil'|'Adulta'|'Outro'
  groups          text[]      default '{}',   -- all groups (dancer may belong to multiple)
  wallet_number   text,               -- Carteira Tradicionalista number
  wallet_expiry   date,
  parent1_name    text,
  parent1_phone   text,
  parent2_name    text,
  parent2_phone   text,
  extra_contacts  jsonb       default '[]',   -- [{type,name,phone,birth_date}]
  allow_order     boolean     default true,
  inactive        boolean     default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists dancers_name_idx       on dancers(name);
create index if not exists dancers_group_name_idx on dancers(group_name);
create index if not exists dancers_inactive_idx   on dancers(inactive);

alter table dancers enable row level security;

create policy if not exists "Anyone can view dancers"
  on dancers for select using (true);

create policy if not exists "Authenticated can insert dancers"
  on dancers for insert with check (auth.role() = 'authenticated');

create policy if not exists "Authenticated can update dancers"
  on dancers for update using (auth.role() = 'authenticated');

create policy if not exists "Authenticated can delete dancers"
  on dancers for delete using (auth.role() = 'authenticated');

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists dancers_updated_at on dancers;
create trigger dancers_updated_at
  before update on dancers
  for each row execute function set_updated_at();


-- =============================================================================
-- 4. GUARDIANS  (app users who are parents/guardians, not team members)
-- =============================================================================

create table if not exists guardians (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete set null,
  name        text        not null,
  phone       text,
  birth_date  date,
  created_at  timestamptz default now()
);

alter table guardians enable row level security;

create policy if not exists "Guardians can read their own record"
  on guardians for select
  using (auth.uid() = user_id or auth.role() = 'authenticated');

create policy if not exists "Authenticated can manage guardians"
  on guardians for all
  using (auth.role() = 'authenticated');


-- =============================================================================
-- 5. DANCER ↔ GUARDIAN  (many-to-many)
-- =============================================================================

create table if not exists dancer_guardians (
  dancer_id   uuid not null references dancers(id)   on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  relation    text default 'guardian',  -- 'guardian'|'grandparent'|'aunt'|'uncle'…
  primary key (dancer_id, guardian_id)
);

alter table dancer_guardians enable row level security;

create policy if not exists "Authenticated can view dancer_guardians"
  on dancer_guardians for select using (auth.role() = 'authenticated');

create policy if not exists "Authenticated can manage dancer_guardians"
  on dancer_guardians for all using (auth.role() = 'authenticated');


-- =============================================================================
-- 6. DINNERS
-- =============================================================================

create table if not exists dinners (
  id                 uuid        primary key default uuid_generate_v4(),
  name               text        not null default 'Janta da Turma',
  date               date,
  status             text        not null default 'active'
                       check (status in ('active', 'closed', 'archived')),
  is_donation        boolean     default true,
  org                text,                     -- organiser display name
  deadline_text      text,                     -- human-readable deadline notice
  lock_time          timestamptz,              -- timestamp when registrations close
  lock_message       text,
  menu               text[]      default '{}',
  price_options      jsonb       default '[]', -- [{label: string, price: number}]
  pix_key            text,
  expense            numeric(10,2) default 0,
  expense_desc       text,
  organizer_phones   text[]      default '{}',
  authorized_phones  text[]      default '{}',
  participants       jsonb       default '{}', -- {phone: displayName}
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

alter table dinners enable row level security;

create policy if not exists "Anyone can view dinners"
  on dinners for select using (true);

create policy if not exists "Authenticated can insert dinners"
  on dinners for insert with check (auth.role() = 'authenticated');

create policy if not exists "Authenticated can update dinners"
  on dinners for update using (auth.role() = 'authenticated');

drop trigger if exists dinners_updated_at on dinners;
create trigger dinners_updated_at
  before update on dinners
  for each row execute function set_updated_at();


-- =============================================================================
-- 7. DINNER PARTICIPANTS
-- =============================================================================

create table if not exists dinner_participants (
  id           uuid        primary key default uuid_generate_v4(),
  dinner_id    uuid        not null references dinners(id) on delete cascade,
  dancer_id    uuid        references dancers(id) on delete set null,
  person_name  text,
  phone        text,
  price        numeric(10,2) default 0,
  price_label  text,
  is_cook      boolean     default false,
  attended     boolean,                    -- null=pending | true=present | false=absent
  paid         boolean     default false,
  pix_paid     boolean     default false,
  created_at   timestamptz default now()
);

create index if not exists dinner_participants_dinner_id_idx on dinner_participants(dinner_id);
create index if not exists dinner_participants_dancer_id_idx on dinner_participants(dancer_id);

alter table dinner_participants enable row level security;

create policy if not exists "Anyone can view dinner participants"
  on dinner_participants for select using (true);

create policy if not exists "Authenticated can manage dinner participants"
  on dinner_participants for all using (auth.role() = 'authenticated');


-- =============================================================================
-- 8. DINNER SCHEDULE  (calendar of upcoming / proposed dinner dates)
-- =============================================================================

create table if not exists dinner_schedule (
  id           text        primary key,    -- app-generated id e.g. 'j1704067200000'
  date         date        not null,
  guardians    text[]      default '{}',   -- names of responsible guardians
  menu         text        default '',
  blocked      boolean     default false,
  block_reason text,
  created_by   text,
  created_at   timestamptz default now()
);

alter table dinner_schedule enable row level security;

create policy if not exists "Anyone can view schedule"
  on dinner_schedule for select using (true);

create policy if not exists "Authenticated can insert schedule"
  on dinner_schedule for insert with check (true);

create policy if not exists "Authenticated can update schedule"
  on dinner_schedule for update using (true);

create policy if not exists "Authenticated can delete schedule"
  on dinner_schedule for delete using (true);


-- =============================================================================
-- 9. ORDERS  (comandas / tabs)
-- =============================================================================

create table if not exists orders (
  id              uuid        primary key default uuid_generate_v4(),
  dinner_id       uuid        references dinners(id)  on delete set null,
  dancer_id       uuid        references dancers(id)  on delete set null,
  user_id         text,           -- phone number or auth user id of creator
  person_name     text,
  description     text,
  amount          numeric(10,2) not null default 0,
  items           jsonb       default '[]',  -- [{description: string, amount: number}]
  paid            boolean     default false,
  payment_method  text,           -- 'pix'|'cash'|'debit'|'credit'
  payment_notes   text,
  phone           text,
  created_by      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists orders_dancer_id_idx on orders(dancer_id);
create index if not exists orders_dinner_id_idx on orders(dinner_id);
create index if not exists orders_paid_idx      on orders(paid);
create index if not exists orders_user_id_idx   on orders(user_id);

alter table orders enable row level security;

create policy if not exists "Anyone can view orders"
  on orders for select using (true);

create policy if not exists "Authenticated can manage orders"
  on orders for all using (auth.role() = 'authenticated');

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at
  before update on orders
  for each row execute function set_updated_at();


-- =============================================================================
-- 10. ORDER PAYMENTS
-- =============================================================================

create table if not exists order_payments (
  id          uuid        primary key default uuid_generate_v4(),
  order_id    uuid        not null references orders(id) on delete cascade,
  amount      numeric(10,2) not null default 0,
  method      text,           -- 'pix'|'cash'|'debit'|'credit'
  notes       text,
  proof_url   text,           -- Supabase Storage URL
  created_at  timestamptz default now()
);

create index if not exists order_payments_order_id_idx on order_payments(order_id);

alter table order_payments enable row level security;

create policy if not exists "Authenticated can view payments"
  on order_payments for select using (auth.role() = 'authenticated');

create policy if not exists "Authenticated can manage payments"
  on order_payments for all using (auth.role() = 'authenticated');


-- =============================================================================
-- 11. DINNER HISTORY  (read-only snapshot after archiving)
-- =============================================================================

create table if not exists dinner_history (
  id              text        primary key,  -- app-generated 'h' + timestamp
  title           text        not null,
  event_date      text,
  organizer       text,
  type            text        default 'regular', -- 'regular'|'donation'
  attendee_count  int         default 0,
  present_count   int         default 0,
  collected       numeric(10,2) default 0,
  expense         numeric(10,2) default 0,
  expense_desc    text,
  menu            text[]      default '{}',
  month           int,
  year            int,
  archived_at     timestamptz default now()
);

alter table dinner_history enable row level security;

create policy if not exists "Authenticated can view dinner history"
  on dinner_history for select using (auth.role() = 'authenticated');

create policy if not exists "Authenticated can manage dinner history"
  on dinner_history for all using (auth.role() = 'authenticated');


-- =============================================================================
-- 12. ACCESS REQUESTS  (people requesting app access)
-- =============================================================================

create table if not exists access_requests (
  id          text        primary key,  -- app-generated 'r' + timestamp
  name        text        not null,
  phone       text        not null,
  reason      text,
  status      text        default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  created_at  timestamptz default now()
);

alter table access_requests enable row level security;

create policy if not exists "Anyone can insert access requests"
  on access_requests for insert with check (true);

create policy if not exists "Authenticated can view access requests"
  on access_requests for select using (auth.role() = 'authenticated');

create policy if not exists "Authenticated can update access requests"
  on access_requests for update using (auth.role() = 'authenticated');

create policy if not exists "Authenticated can delete access requests"
  on access_requests for delete using (auth.role() = 'authenticated');


-- =============================================================================
-- 13. AUDIT LOGS
-- =============================================================================

create table if not exists audit_logs (
  id          uuid    primary key default uuid_generate_v4(),
  type        text    not null
                check (type in ('super', 'organizer', 'guardian')),
  action      text    not null,
  actor       text,
  before      text,
  after       text,
  created_at  timestamptz default now()
);

alter table audit_logs enable row level security;

create policy if not exists "Authenticated can insert audit logs"
  on audit_logs for insert with check (auth.role() = 'authenticated');

create policy if not exists "Authenticated can view audit logs"
  on audit_logs for select using (auth.role() = 'authenticated');


-- =============================================================================
-- 14. STORAGE BUCKET — payment receipts
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('payment_receipts', 'payment_receipts', false)
on conflict (id) do nothing;

create policy if not exists "Authenticated can upload receipts"
  on storage.objects for insert
  with check (bucket_id = 'payment_receipts' and auth.role() = 'authenticated');

create policy if not exists "Authenticated can view receipts"
  on storage.objects for select
  using (bucket_id = 'payment_receipts' and auth.role() = 'authenticated');


-- =============================================================================
-- 15. HELPER VIEWS
-- =============================================================================

create or replace view v_active_dinner as
  select
    d.*,
    count(p.id)                                              as participant_count,
    coalesce(sum(p.price) filter (where not p.is_cook), 0)  as total_collected,
    count(p.id) filter (where p.attended = true)             as present_count
  from dinners d
  left join dinner_participants p on p.dinner_id = d.id
  where d.status = 'active'
  group by d.id;

create or replace view v_dancers_wallet_status as
  select
    d.*,
    case
      when wallet_expiry is null              then 'none'
      when wallet_expiry < current_date       then 'expired'
      when wallet_expiry < current_date + 30  then 'expiring_soon'
      else                                         'ok'
    end                                        as wallet_status,
    (wallet_expiry - current_date)             as wallet_days_remaining
  from dancers d
  where not inactive;

create or replace view v_open_orders as
  select
    o.*,
    d.name   as dancer_name,
    d.groups as dancer_groups
  from orders o
  left join dancers d on d.id = o.dancer_id
  where not o.paid;

create or replace view v_dinner_schedule_upcoming as
  select *
  from dinner_schedule
  where date >= current_date
  order by date;


-- =============================================================================
-- SUMMARY
-- =============================================================================
-- Roles: super | board | coordination | secretariat | kitchen | treasury |
--        organizer | guardian
--
-- Tables (13):
--   roles, user_roles,
--   dancers, guardians, dancer_guardians,
--   dinners, dinner_participants, dinner_schedule,
--   orders, order_payments,
--   dinner_history, access_requests, audit_logs
--
-- Views (4): v_active_dinner, v_dancers_wallet_status,
--            v_open_orders, v_dinner_schedule_upcoming
--
-- Storage: payment_receipts (private bucket)
-- =============================================================================
