-- ═══════════════════════════════════════════════════════════════════════════
--  Erlekide — Migrazioa: Vespa velutina deklarazioak
--  BD bizia duten instalazioentzat. Exekutatu Supabase > SQL Editor-en.
--  Para instalaciones con BD existente. Ejecutar en Supabase > SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.velutina_sightings (
  id         text        primary key default gen_random_uuid()::text,
  project_id text        not null references public.projects(id) on delete cascade,
  count      integer     not null check (count >= 0 and count <= 99),
  notes      text        not null default '',
  username   text        not null,
  created_by uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists velutina_project_idx on public.velutina_sightings(project_id, created_at desc);

alter table public.velutina_sightings enable row level security;

-- Politika berdinak beste datu-taulen moduan / mismas políticas que el resto
drop policy if exists velutina_sightings_psel on public.velutina_sightings;
drop policy if exists velutina_sightings_pins on public.velutina_sightings;
drop policy if exists velutina_sightings_pupd on public.velutina_sightings;
drop policy if exists velutina_sightings_pdel on public.velutina_sightings;
create policy velutina_sightings_psel on public.velutina_sightings for select using (public.is_member(project_id));
create policy velutina_sightings_pins on public.velutina_sightings for insert with check (public.can_edit(project_id));
create policy velutina_sightings_pupd on public.velutina_sightings for update using (public.can_edit(project_id)) with check (public.can_edit(project_id));
create policy velutina_sightings_pdel on public.velutina_sightings for delete using (public.can_edit(project_id));
