-- ═══════════════════════════════════════════════════════════════════════════
--  Erlekide — Supabase Eskema / Schema (PROIEKTU ANITZ / MULTIPROYECTO)
--  Instalazio BERRIENTZAT. BD bizia baduzu, erabili migrate-projects.sql.
--  Para instalaciones NUEVAS. Si ya tienes datos, usa migrate-projects.sql.
--  Supabase > SQL Editor-en exekutatu / Ejecutar en Supabase > SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── updated_at triggerra / trigger ───────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Proiektuak / Proyectos ───────────────────────────────────────────────────
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

-- Taldekideak (sarbidea) — EZ nahastu `members`-ekin (gastuetako sozioak)
-- Miembros (acceso) — NO confundir con `members` (socios del reparto de gastos)
create table if not exists public.project_members (
  project_id text        not null references public.projects(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       text        not null default 'viewer' check (role in ('owner','editor','viewer')),
  username   text,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user_idx on public.project_members(user_id);

-- ── Erlauntzak / Colmenas ─────────────────────────────────────────────────────
create table if not exists public.hives (
  id           text        primary key default gen_random_uuid()::text,
  project_id   text        not null references public.projects(id) on delete cascade,
  name         text        not null,
  type         text        not null default 'Langstroth',
  race         text        not null default 'Iberiensis',
  status       text        not null default 'good',
  color        text        not null default '#C8780A',
  install_date date,
  notes        text        not null default '',
  frames       integer     check (frames >= 5 and frames <= 10),
  alzas        jsonb       not null default '[]'::jsonb,
  grid_x       integer,
  grid_y       integer,
  created_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists hives_project_idx on public.hives(project_id);

drop trigger if exists hives_updated_at on public.hives;
create trigger hives_updated_at before update on public.hives
  for each row execute function public.set_updated_at();

-- ── Ikuskaritzak / Inspecciones ───────────────────────────────────────────────
create table if not exists public.inspections (
  id          text        primary key default gen_random_uuid()::text,
  project_id  text        not null references public.projects(id) on delete cascade,
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
create index if not exists inspections_hive_id_idx on public.inspections(hive_id);
create index if not exists inspections_date_idx    on public.inspections(date desc);
create index if not exists inspections_project_idx on public.inspections(project_id);

-- ── Sozioak / Socios (reparto de gastos) ──────────────────────────────────────
create table if not exists public.members (
  id         text        primary key default gen_random_uuid()::text,
  project_id text        not null references public.projects(id) on delete cascade,
  name       text        not null,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);
create index if not exists members_project_idx on public.members(project_id);

-- ── Gastuak / Gastos ──────────────────────────────────────────────────────────
create table if not exists public.expenses (
  id          text          primary key default gen_random_uuid()::text,
  project_id  text          not null references public.projects(id) on delete cascade,
  description text          not null,
  amount      numeric(10,2) not null check (amount > 0),
  paid_by     text          not null,
  date        date          not null default current_date,
  notes       text          not null default '',
  created_by  uuid          references auth.users(id) on delete set null,
  created_at  timestamptz   not null default now()
);
create index if not exists expenses_project_idx on public.expenses(project_id);

-- ── Materialak / Materiales ───────────────────────────────────────────────────
create table if not exists public.materials (
  id         text        primary key default gen_random_uuid()::text,
  project_id text        not null references public.projects(id) on delete cascade,
  name       text        not null,
  category   text        not null default 'bestelakoa'
               check (category in ('kaxak','jantziak','tresnak','bestelakoa')),
  quantity   integer     not null default 1 check (quantity >= 0),
  notes      text        not null default '',
  created_by uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists materials_project_idx on public.materials(project_id);
drop trigger if exists materials_updated_at on public.materials;
create trigger materials_updated_at before update on public.materials
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
--  SEGURTASUN-LAGUNTZAILEAK / HELPERS (SECURITY DEFINER, sin recursión RLS)
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.is_member(p_pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members
    where project_id = p_pid and user_id = auth.uid());
$$;

create or replace function public.can_edit(p_pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members
    where project_id = p_pid and user_id = auth.uid() and role in ('owner','editor'));
$$;

create or replace function public.is_owner(p_pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = p_pid and owner_id = auth.uid());
$$;

create or replace function public.my_username()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(raw_user_meta_data->>'username', split_part(email, '@', 1))
  from auth.users where id = auth.uid();
$$;

-- ══════════════════════════════════════════════════════════════════════════════
--  RPCak / Funciones RPC (operaciones sensibles, atómicas)
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.create_project(p_name text)
returns public.projects language plpgsql security definer set search_path = public as $$
declare v_proj public.projects; v_code text;
begin
  if auth.uid() is null then raise exception 'Autentifikazioa behar da'; end if;
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
declare v_proj public.projects;
begin
  if auth.uid() is null then raise exception 'Autentifikazioa behar da'; end if;
  select * into v_proj from public.projects where upper(join_code) = upper(btrim(p_code));
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
     set cols = greatest(3, least(20, p_cols)), rows = greatest(1, least(15, p_rows))
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
  if p_uid = auth.uid() then raise exception 'Jabea ezin da kendu'; end if;
  delete from public.project_members where project_id = p_pid and user_id = p_uid;
end;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
--  RLS — proiektuko kidetzaren araberako / por pertenencia al proyecto
-- ══════════════════════════════════════════════════════════════════════════════
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.hives           enable row level security;
alter table public.inspections     enable row level security;
alter table public.members         enable row level security;
alter table public.expenses        enable row level security;
alter table public.materials       enable row level security;

-- projects: kideek irakurri; jabeak aldatu/ezabatu; sortzea RPCz
create policy projects_select on public.projects for select using (public.is_member(id));
create policy projects_update on public.projects for update using (public.is_owner(id));
create policy projects_delete on public.projects for delete using (public.is_owner(id));

-- project_members: kideek ikusi; idazketa RPCz soilik (politika gabe)
create policy pmembers_select on public.project_members for select using (public.is_member(project_id));

-- datu-taulak: kideek irakurri, editoreek+jabeak idatzi
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
