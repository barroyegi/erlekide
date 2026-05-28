-- ═══════════════════════════════════════════════════════════════
--  Erlekide — Supabase Eskema / Schema
--  Supabase SQL Editor-en exekutatu / Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── Erlauntzak / Colmenas ─────────────────────────────────────
create table if not exists public.hives (
  id           text        primary key default gen_random_uuid()::text,
  name         text        not null,
  type         text        not null default 'Langstroth',
  race         text        not null default 'Iberiensis',
  status       text        not null default 'good',
  color        text        not null default '#C8780A',
  install_date date,
  notes        text        not null default '',
  grid_x       integer,
  grid_y       integer,
  created_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Ikuskaritzak / Inspecciones ───────────────────────────────
create table if not exists public.inspections (
  id          text        primary key default gen_random_uuid()::text,
  hive_id     text        not null references public.hives(id) on delete cascade,
  date        date        not null,
  strength    integer     not null default 5,
  brood       integer     not null default 0,
  honey       integer     not null default 0,
  queen       text        not null default 'unknown',
  varroa      text        not null default 'unknown',
  status      text        not null default 'good',
  notes       text        not null default '',
  ai_summary  text        not null default '',
  username    text        not null,
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── updated_at triggerra / trigger ────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hives_updated_at on public.hives;
create trigger hives_updated_at
  before update on public.hives
  for each row execute function public.set_updated_at();

-- ── Indizeak / Índices ────────────────────────────────────────
create index if not exists inspections_hive_id_idx on public.inspections(hive_id);
create index if not exists inspections_date_idx     on public.inspections(date desc);

-- ══════════════════════════════════════════════════════════════
--  RLS (Row Level Security)
--  Erabiltzaile autentifikatuek datu guztiak ikus ditzakete
--  Todos los usuarios autenticados pueden ver y editar los datos
-- ══════════════════════════════════════════════════════════════

alter table public.hives        enable row level security;
alter table public.inspections  enable row level security;

-- Erlauntzak politikak / Políticas colmenas
create policy "hives_select" on public.hives for select
  using (auth.role() = 'authenticated');
create policy "hives_insert" on public.hives for insert
  with check (auth.role() = 'authenticated');
create policy "hives_update" on public.hives for update
  using (auth.role() = 'authenticated');
create policy "hives_delete" on public.hives for delete
  using (auth.role() = 'authenticated');

-- Ikuskaritzen politikak / Políticas inspecciones
create policy "insp_select" on public.inspections for select
  using (auth.role() = 'authenticated');
create policy "insp_insert" on public.inspections for insert
  with check (auth.role() = 'authenticated');
create policy "insp_delete" on public.inspections for delete
  using (auth.role() = 'authenticated');
