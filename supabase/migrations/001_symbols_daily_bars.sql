-- Symbols tracked for OHLC ingestion + daily bars (Supabase / Postgres)

create table if not exists public.symbols (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  company_name text,
  created_at timestamptz not null default now(),
  ohlc_synced_at timestamptz
);

create index if not exists symbols_symbol_idx on public.symbols (symbol);

create table if not exists public.daily_bars (
  id uuid primary key default gen_random_uuid(),
  symbol_id uuid not null references public.symbols (id) on delete cascade,
  trade_date date not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume bigint not null default 0,
  adj_close numeric,
  constraint daily_bars_symbol_date_unique unique (symbol_id, trade_date)
);

create index if not exists daily_bars_symbol_date_idx on public.daily_bars (symbol_id, trade_date);

comment on table public.symbols is 'One row per ticker with ingested OHLC metadata';
comment on column public.symbols.ohlc_synced_at is 'Set when a full daily OHLC sync completed successfully';
comment on table public.daily_bars is 'Daily OHLCV bars per symbol';
