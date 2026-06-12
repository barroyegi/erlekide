-- ═══════════════════════════════════════════════════════════════════════════
--  Erlekide — Migrazioa: PROIEKTU ANITZ / Migración: MULTIPROYECTO
--  Datu-base BIZIENTZAT (datuekin) / Para BD VIVA (con datos existentes)
--
--  Bi tandatan exekutatu Supabase > SQL Editor-en:
--  Ejecutar en DOS TANDAS en Supabase > SQL Editor:
--    • TANDA 1 — orain (gehigarria, ez du ezer hausten). Front zaharrak lanean
--      jarraituko du. / ahora (aditiva, no rompe nada; la app actual sigue igual).
--    • TANDA 2 — front berria zabaldu ONDOREN (proiektuak isolatzen ditu).
--      / DESPUÉS de desplegar el frontend nuevo (aísla los proyectos).
-- ═══════════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  TANDA 1 — GEHIGARRIA / ADITIVA (segura, ejecutar ahora)                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ── Proiektuak / Proyectos ───────────────────────────────────────────────────
-- Sarbide-kode irakurgarria sortzeko (karaktere anbiguorik gabe: ez 0/O, 1/I/L)
-- Genera un código de invitación legible (sin caracteres ambiguos)
create or replace function public.gen_join_code()
returns text language sql volatile as $$
  select string_agg(
    substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', (floor(random() * 31) + 1)::int, 1), '')
  from generate_series(1, 6);
$$;

create table if not exists public.projects (
  id         text        primary key default gen_random_uuid()::text,
  name       text        not null,
  owner_id   uuid        not null references auth.users(id) on delete cascade,
  cols       integer     not null default 14,
  rows       integer     not null default 10,
  join_code  text        not null unique default public.gen_join_code(),
  created_at timestamptz not null default now()
);

-- ── Taldekideak (sarbidea) / Miembros (acceso) ───────────────────────────────
-- OHARRA: hau EZ da `members` taula (hura gastuetako sozioak dira).
-- NOTA: NO es la tabla `members` (esos son los socios del reparto de gastos).
create table if not exists public.project_members (
  project_id text        not null references public.projects(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       text        not null default 'viewer' check (role in ('owner','editor','viewer')),
  username   text,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user_idx on public.project_members(user_id);

-- ── project_id zutabea datu-tauletan (NULLABLE oraingoz) ─────────────────────
-- Columna project_id en las tablas de datos (NULLABLE de momento)
alter table public.hives       add column if not exists project_id text references public.projects(id) on delete cascade;
alter table public.hives       add column if not exists alzas      jsonb not null default '[]'::jsonb;
alter table public.inspections add column if not exists project_id text references public.projects(id) on delete cascade;
alter table public.expenses    add column if not exists project_id text references public.projects(id) on delete cascade;
alter table public.materials   add column if not exists project_id text references public.projects(id) on delete cascade;
alter table public.members     add column if not exists project_id text references public.projects(id) on delete cascade;

create index if not exists hives_project_idx       on public.hives(project_id);
create index if not exists inspections_project_idx on public.inspections(project_id);
create index if not exists expenses_project_idx    on public.expenses(project_id);
create index if not exists materials_project_idx   on public.materials(project_id);
create index if not exists members_project_idx     on public.members(project_id);

-- Sozioen izen-bakartasuna globaletik proiektukora / unicidad de socios: global → por proyecto
alter table public.members drop constraint if exists members_name_key;

-- ── Segurtasun-laguntzaileak / Helpers de seguridad ──────────────────────────
-- SECURITY DEFINER: project_members-en RLSa saihesten dute (errekurtsioa ekiditeko)
-- SECURITY DEFINER: evitan la RLS de project_members (sin recursión)
create or replace function public.is_member(p_pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_pid and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit(p_pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_pid and user_id = auth.uid() and role in ('owner','editor')
  );
$$;

create or replace function public.is_owner(p_pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects where id = p_pid and owner_id = auth.uid()
  );
$$;

-- ── RPCak / Funciones RPC (operaciones sensibles, atómicas) ──────────────────
-- Erabiltzailearen izena auth.users-etik / nombre de usuario desde auth.users
create or replace function public.my_username()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(raw_user_meta_data->>'username', split_part(email, '@', 1))
  from auth.users where id = auth.uid();
$$;

create or replace function public.create_project(p_name text)
returns public.projects language plpgsql security definer set search_path = public as $$
declare
  v_proj public.projects;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Autentifikazioa behar da'; end if;
  -- kode bakarra bermatu / asegurar código único
  loop
    v_code := public.gen_join_code();
    exit when not exists (select 1 from public.projects where join_code = v_code);
  end loop;
  insert into public.projects(name, owner_id, join_code)
    values (coalesce(nullif(btrim(p_name), ''), 'Erlategia'), auth.uid(), v_code)
    returning * into v_proj;
  insert into public.project_members(project_id, user_id, role, username)
    values (v_proj.id, auth.uid(), 'owner', public.my_username());
  return v_proj;
end;
$$;

create or replace function public.join_project(p_code text)
returns public.projects language plpgsql security definer set search_path = public as $$
declare
  v_proj public.projects;
begin
  if auth.uid() is null then raise exception 'Autentifikazioa behar da'; end if;
  select * into v_proj from public.projects
    where upper(join_code) = upper(btrim(p_code));
  if v_proj.id is null then raise exception 'Kode baliogabea / código no válido'; end if;
  insert into public.project_members(project_id, user_id, role, username)
    values (v_proj.id, auth.uid(), 'viewer', public.my_username())
    on conflict (project_id, user_id) do nothing;
  return v_proj;
end;
$$;

create or replace function public.set_grid(p_pid text, p_cols int, p_rows int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit(p_pid) then raise exception 'Baimenik ez / sin permiso'; end if;
  update public.projects
     set cols = greatest(3, least(20, p_cols)),
         rows = greatest(1, least(15, p_rows))
   where id = p_pid;
end;
$$;

create or replace function public.regenerate_join_code(p_pid text)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_owner(p_pid) then raise exception 'Jabeak soilik / solo el propietario'; end if;
  loop
    v_code := public.gen_join_code();
    exit when not exists (select 1 from public.projects where join_code = v_code);
  end loop;
  update public.projects set join_code = v_code where id = p_pid;
  return v_code;
end;
$$;

create or replace function public.set_member_role(p_pid text, p_uid uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_pid) then raise exception 'Jabeak soilik / solo el propietario'; end if;
  if p_role not in ('editor','viewer') then raise exception 'Rol baliogabea'; end if;
  if p_uid = auth.uid() then raise exception 'Jabeak ezin du bere burua aldatu'; end if;
  update public.project_members set role = p_role where project_id = p_pid and user_id = p_uid;
end;
$$;

create or replace function public.remove_member(p_pid text, p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_pid) then raise exception 'Jabeak soilik / solo el propietario'; end if;
  if p_uid = auth.uid() then raise exception 'Jabea ezin da kendu / no se puede quitar al propietario'; end if;
  delete from public.project_members where project_id = p_pid and user_id = p_uid;
end;
$$;

-- ── RLS proiektu-tauletan / RLS en las tablas de proyecto ────────────────────
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select using (public.is_member(id));
-- insert: RPCk soilik (security definer) / solo vía RPC
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update using (public.is_owner(id));
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete using (public.is_owner(id));

drop policy if exists pmembers_select on public.project_members;
create policy pmembers_select on public.project_members for select using (public.is_member(project_id));
-- idazketa guztia RPCk (security definer) / toda escritura vía RPC: sin políticas write

-- ── Lehenetsitako proiektua + datuen migrazioa / Proyecto por defecto + backfill ──
do $$
declare
  v_owner uuid;
  v_proj  text;
  v_cols  int;
  v_rows  int;
begin
  -- jabea: kolmena gehien sortu dituena; bestela lehen erabiltzailea
  -- owner: quien creó más colmenas; si no, el primer usuario
  select coalesce(
    (select created_by from public.hives where created_by is not null
       group by created_by order by count(*) desc limit 1),
    (select id from auth.users order by created_at limit 1)
  ) into v_owner;

  if v_owner is null then
    raise notice 'Ez dago erabiltzailerik; lehenetsitako proiektua saltatzen / sin usuarios, se omite.';
    return;
  end if;

  -- jada migratuta badago, ez errepikatu / si ya hay proyectos, no repetir
  if exists (select 1 from public.projects) then
    raise notice 'Jada badaude proiektuak; migrazioa saltatzen / ya hay proyectos, se omite el backfill.';
    return;
  end if;

  select coalesce((select cols from public.settings where id = 'main'), 14),
         coalesce((select rows from public.settings where id = 'main'), 10)
    into v_cols, v_rows;

  insert into public.projects(name, owner_id, cols, rows)
    values ('Nire erlategia', v_owner, v_cols, v_rows)
    returning id into v_proj;

  update public.hives       set project_id = v_proj where project_id is null;
  update public.inspections set project_id = v_proj where project_id is null;
  update public.expenses    set project_id = v_proj where project_id is null;
  update public.materials   set project_id = v_proj where project_id is null;
  update public.members     set project_id = v_proj where project_id is null;

  -- erabiltzaile guztiak kide: aukeratutakoa jabe, gainerakoak editore
  -- todos los usuarios como miembros: el elegido owner, el resto editores
  insert into public.project_members(project_id, user_id, role, username)
  select v_proj, u.id,
         case when u.id = v_owner then 'owner' else 'editor' end,
         coalesce(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))
  from auth.users u
  on conflict (project_id, user_id) do nothing;

  raise notice 'Migrazioa OK. Proiektua: %', v_proj;
end $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  TANDA 2 — BLOKEOA / BLOQUEO                                               ║
-- ║  Front berria zabaldu ETA probatu ONDOREN exekutatu.                      ║
-- ║  Ejecutar SOLO tras desplegar y probar el frontend nuevo.                 ║
-- ║  (Lerro hauek deskomentatu eta exekutatu / descomentar y ejecutar)        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
/*
-- 1) project_id derrigorrezko / obligatorio
alter table public.hives       alter column project_id set not null;
alter table public.inspections alter column project_id set not null;
alter table public.expenses    alter column project_id set not null;
alter table public.materials   alter column project_id set not null;
alter table public.members     alter column project_id set not null;

-- 2) sozioak proiektuko bakarrak / socios únicos por proyecto
alter table public.members drop constraint if exists members_project_id_name_key;
alter table public.members add constraint members_project_id_name_key unique (project_id, name);

-- 3) politika zaharrak kendu / quitar políticas permisivas viejas
drop policy if exists hives_select on public.hives;
drop policy if exists hives_insert on public.hives;
drop policy if exists hives_update on public.hives;
drop policy if exists hives_delete on public.hives;
drop policy if exists insp_select on public.inspections;
drop policy if exists insp_insert on public.inspections;
drop policy if exists insp_update on public.inspections;
drop policy if exists insp_delete on public.inspections;
drop policy if exists expenses_select on public.expenses;
drop policy if exists expenses_insert on public.expenses;
drop policy if exists expenses_delete on public.expenses;
drop policy if exists members_select on public.members;
drop policy if exists members_insert on public.members;
drop policy if exists members_delete on public.members;
drop policy if exists materials_select on public.materials;
drop policy if exists materials_insert on public.materials;
drop policy if exists materials_update on public.materials;
drop policy if exists materials_delete on public.materials;

-- 4) politika berriak proiektuka / nuevas políticas por proyecto
do $$
declare t text;
begin
  foreach t in array array['hives','inspections','expenses','materials','members'] loop
    execute format('create policy %I on public.%I for select using (public.is_member(project_id));', t||'_psel', t);
    execute format('create policy %I on public.%I for insert with check (public.can_edit(project_id));', t||'_pins', t);
    execute format('create policy %I on public.%I for update using (public.can_edit(project_id)) with check (public.can_edit(project_id));', t||'_pupd', t);
    execute format('create policy %I on public.%I for delete using (public.can_edit(project_id));', t||'_pdel', t);
  end loop;
end $$;

-- 5) settings zaharra ez da erabiltzen / la tabla settings global ya no se usa
--    (nahi izanez gero ezabatu / borrar si se desea)
-- drop table if exists public.settings;
*/
