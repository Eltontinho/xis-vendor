-- vendor_conversations
create table if not exists vendor_conversations (
  id uuid primary key default gen_random_uuid(),
  driver_phone text,
  driver_name text,
  driver_city text,
  messages jsonb not null default '[]'::jsonb,
  current_state text not null default 'greeting',
  lot_offered text,
  payment_status text not null default 'none',
  created_at timestamptz not null default now()
);

-- lot_inventory
create table if not exists lot_inventory (
  city text not null,
  lot text not null,
  total integer not null default 0,
  reserved integer not null default 0,
  sold integer not null default 0,
  primary key (city, lot)
);

-- lot_locks
create table if not exists lot_locks (
  id uuid primary key default gen_random_uuid(),
  driver_phone text not null,
  city text not null,
  lot text not null,
  status text not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Multi-agent classification columns
alter table vendor_conversations
  add column if not exists driver_profile text,
  add column if not exists driver_emotion text,
  add column if not exists driver_temperature text,
  add column if not exists driver_commitment text,
  add column if not exists risk_flag boolean default false,
  add column if not exists reserved_number text;

-- Índices
create index if not exists idx_lot_locks_phone on lot_locks(driver_phone);
create index if not exists idx_lot_locks_status on lot_locks(status);
create index if not exists idx_vendor_conversations_phone on vendor_conversations(driver_phone);

-- Seed de exemplo (ajuste conforme necessário)
insert into lot_inventory (city, lot, total, reserved, sold)
values
  ('São Paulo', 'lote1', 100, 0, 0),
  ('São Paulo', 'lote2', 200, 0, 0),
  ('São Paulo', 'lote3', 300, 0, 0),
  ('Rio de Janeiro', 'lote1', 100, 0, 0),
  ('Rio de Janeiro', 'lote2', 200, 0, 0),
  ('Rio de Janeiro', 'lote3', 300, 0, 0)
on conflict (city, lot) do nothing;

-- leads (perfil qualificado)
create table if not exists leads (
  id         uuid primary key default gen_random_uuid(),
  nome       text,
  cidade     text,
  veiculo    text,
  telefone   text unique,
  stage      text default 'cadastro_pendente',
  created_at timestamptz default now()
);

-- lead_states (Elton v2)
create table if not exists lead_states (
  phone      text primary key,
  stage      text not null default 'novo',
  history    jsonb not null default '[]',
  "updatedAt" timestamptz not null default now()
);

-- Canal de origem por conversa
alter table lead_states
  add column if not exists channel text not null default 'web';

alter table vendor_conversations
  add column if not exists channel text not null default 'web';

-- Cadastro data: endereço e placa do motorista
alter table vendor_conversations
  add column if not exists driver_address text,
  add column if not exists driver_plate text;

-- Drivers: registro de motoristas que concluíram o pagamento
create table if not exists drivers (
  id             uuid default gen_random_uuid() primary key,
  name           text,
  phone          text,
  email          text,
  address        text,
  plate          text,
  plan           text,
  lot_number     text,
  payment_status text,
  created_at     timestamptz default now()
);
