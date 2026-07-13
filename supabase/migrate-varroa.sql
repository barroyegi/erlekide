-- ═══════════════════════════════════════════════════════════════════════════
--  Erlekide — Migrazioa: Varroa testak + tratamenduak eta Realtime
--  BD bizia duten instalazioentzat. Exekutatu Supabase > SQL Editor-en.
--  Para instalaciones con BD existente. Ejecutar en Supabase > SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Varroa testak ──────────────────────────────────────────────────────────────
create table if not exists public.varroa_tests (
  id         text          primary key default gen_random_uuid()::text,
  project_id text          not null references public.projects(id) on delete cascade,
  hive_id    text          not null references public.hives(id) on delete cascade,
  date       date          not null,
  method     text          not null default 'wash' check (method in ('wash','drop','other')),
  mites      numeric(7,1)  not null default 0 check (mites >= 0),
  sample     integer       check (sample is null or sample > 0),
  notes      text          not null default '',
  username   text          not null,
  created_by uuid          references auth.users(id) on delete set null,
  created_at timestamptz   not null default now()
);
create index if not exists varroa_tests_hive_idx    on public.varroa_tests(hive_id, date desc);
create index if not exists varroa_tests_project_idx on public.varroa_tests(project_id);

-- ── Varroa tratamenduak ──────────────────────────────────────────────────────
create table if not exists public.varroa_treatments (
  id         text        primary key default gen_random_uuid()::text,
  project_id text        not null references public.projects(id) on delete cascade,
  hive_id    text        not null references public.hives(id) on delete cascade,
  product    text        not null,
  start_date date        not null,
  end_date   date,
  notes      text        not null default '',
  username   text        not null,
  created_by uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists varroa_treat_hive_idx    on public.varroa_treatments(hive_id, start_date desc);
create index if not exists varroa_treat_project_idx on public.varroa_treatments(project_id);

-- ── RLS (beste datu-taulen politika berdinak) ─────────────────────────────────
alter table public.varroa_tests      enable row level security;
alter table public.varroa_treatments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['varroa_tests','varroa_treatments'] loop
    execute format('drop policy if exists %I on public.%I;', t||'_psel', t);
    execute format('drop policy if exists %I on public.%I;', t||'_pins', t);
    execute format('drop policy if exists %I on public.%I;', t||'_pupd', t);
    execute format('drop policy if exists %I on public.%I;', t||'_pdel', t);
    execute format('create policy %I on public.%I for select using (public.is_member(project_id));', t||'_psel', t);
    execute format('create policy %I on public.%I for insert with check (public.can_edit(project_id));', t||'_pins', t);
    execute format('create policy %I on public.%I for update using (public.can_edit(project_id)) with check (public.can_edit(project_id));', t||'_pupd', t);
    execute format('create policy %I on public.%I for delete using (public.can_edit(project_id));', t||'_pdel', t);
  end loop;
end $$;

-- ── Realtime (30s polling-aren ordez) ─────────────────────────────────────────
-- Taula guztiak publikaziora gehitzen ditu, ez soilik varroa berriak,
-- lehendik dauden instalazioek ere Realtime izan dezaten.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['hives','inspections','expenses','materials','members',
                           'velutina_sightings','varroa_tests','varroa_treatments','projects'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;
