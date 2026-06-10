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

-- ⚠️ Politika hau falta zen: gabe, inspekzioak EZIN dira editatu (isilik huts egiten du).
--    Dagoeneko sortutako datu-baseetan, exekutatu bi lerro hauek Supabase SQL Editor-en.
-- ⚠️ Esta política faltaba: sin ella, EDITAR inspecciones falla silenciosamente.
--    En bases de datos ya creadas, ejecutar estas dos líneas en el SQL Editor de Supabase.
drop policy if exists "insp_update" on public.inspections;
create policy "insp_update" on public.inspections for update
  using (auth.role() = 'authenticated');

-- ── Konfigurazioa (grid neurria) / Configuración del grid ────────────────────
create table if not exists public.settings (
  id         text        primary key default 'main',
  cols       integer     not null default 14,
  rows       integer     not null default 10,
  updated_at timestamptz not null default now()
);

-- Fila por defecto / Lehenetsitako errenkada
insert into public.settings (id, cols, rows) values ('main', 14, 10)
  on conflict (id) do nothing;

alter table public.settings enable row level security;
create policy "settings_select" on public.settings for select
  using (auth.role() = 'authenticated');
create policy "settings_insert" on public.settings for insert
  with check (auth.role() = 'authenticated');
create policy "settings_update" on public.settings for update
  using (auth.role() = 'authenticated');

-- ── Markoak zutabea / Columna de marcos ──────────────────────────────────────
-- (Dagoeneko sortutako taulan exekutatu / Ejecutar si la tabla ya existe)
alter table public.hives
  add column if not exists frames integer check (frames >= 5 and frames <= 10);

-- ════════════════════════════════════════════════════════════════════════════
--  GASTUAK / MATERIALAK / SOZIOAK
-- ════════════════════════════════════════════════════════════════════════════

-- ── Sozioak / Partners ───────────────────────────────────────────────────────
create table if not exists public.members (
  id         text        primary key default gen_random_uuid()::text,
  name       text        not null unique,
  created_at timestamptz not null default now()
);
alter table public.members enable row level security;
create policy "members_select" on public.members for select using (auth.role() = 'authenticated');
create policy "members_insert" on public.members for insert with check (auth.role() = 'authenticated');
create policy "members_delete" on public.members for delete using (auth.role() = 'authenticated');

-- ── Gastuak / Expenses ───────────────────────────────────────────────────────
create table if not exists public.expenses (
  id          text          primary key default gen_random_uuid()::text,
  description text          not null,
  amount      numeric(10,2) not null check (amount > 0),
  paid_by     text          not null,
  date        date          not null default current_date,
  notes       text          not null default '',
  created_by  uuid          references auth.users(id) on delete set null,
  created_at  timestamptz   not null default now()
);
alter table public.expenses enable row level security;
create policy "expenses_select" on public.expenses for select using (auth.role() = 'authenticated');
create policy "expenses_insert" on public.expenses for insert with check (auth.role() = 'authenticated');
create policy "expenses_delete" on public.expenses for delete using (auth.role() = 'authenticated');

-- ── Materialak / Materials ───────────────────────────────────────────────────
create table if not exists public.materials (
  id         text        primary key default gen_random_uuid()::text,
  name       text        not null,
  category   text        not null default 'bestelakoa'
               check (category in ('kaxak','jantziak','tresnak','bestelakoa')),
  quantity   integer     not null default 1 check (quantity >= 0),
  notes      text        not null default '',
  created_by uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger materials_updated_at before update on public.materials
  for each row execute function public.set_updated_at();
alter table public.materials enable row level security;
create policy "materials_select" on public.materials for select using (auth.role() = 'authenticated');
create policy "materials_insert" on public.materials for insert with check (auth.role() = 'authenticated');
create policy "materials_update" on public.materials for update using (auth.role() = 'authenticated');
create policy "materials_delete" on public.materials for delete using (auth.role() = 'authenticated');
