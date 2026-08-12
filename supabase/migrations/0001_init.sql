-- Resilience Maps — initial schema (PostGIS)
create extension if not exists postgis;

create type facility_category as enum
  ('hospital','school','shelter','water','power','comms');
create type facility_status as enum
  ('operational','degraded','down','unknown');

create table public.facilities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      facility_category not null,
  geom          geometry(Point, 4326) not null,
  address       text,
  phone         text,
  capacity      integer,                 -- people (shelter beds, seats, ...)
  occupancy     integer,                 -- current, if known
  resources     jsonb not null default '{}'::jsonb,
  status        facility_status not null default 'unknown',
  status_note   text,
  last_updated  timestamptz not null default now(),
  verified_by   text
);

create index facilities_geom_gix on public.facilities using gist (geom);
create index facilities_category_idx on public.facilities (category);

create table public.facility_reports (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.facilities(id) on delete cascade,
  status       facility_status not null,
  note         text,
  reporter     text,
  created_at   timestamptz not null default now()
);

create table public.offline_regions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  bbox        geometry(Polygon, 4326) not null,
  tiles_url   text not null,
  size_mb     numeric not null,
  updated_at  timestamptz not null default now()
);

create table public.alerts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  severity    text not null check (severity in ('info','warning','critical')),
  area        geometry(Polygon, 4326),
  created_at  timestamptz not null default now()
);

-- Keep facilities in sync with the newest report
create or replace function public.apply_report() returns trigger as $$
begin
  update public.facilities
     set status = new.status,
         status_note = new.note,
         last_updated = new.created_at
   where id = new.facility_id;
  return new;
end $$ language plpgsql security definer;

create trigger trg_apply_report
  after insert on public.facility_reports
  for each row execute function public.apply_report();

-- Facilities with plain lng/lat columns (what the web client consumes)
create or replace function public.facilities_with_coords()
returns table (
  id uuid, name text, category facility_category, address text, phone text,
  capacity integer, occupancy integer, resources jsonb,
  status facility_status, status_note text, last_updated timestamptz,
  verified_by text, lng float8, lat float8
) language sql stable as $$
  select f.id, f.name, f.category, f.address, f.phone, f.capacity, f.occupancy,
         f.resources, f.status, f.status_note, f.last_updated, f.verified_by,
         st_x(f.geom) as lng, st_y(f.geom) as lat
  from public.facilities f;
$$;

-- Everything inside a bounding box (region download snapshots)
create or replace function public.facilities_in_bbox(
  min_lng float8, min_lat float8, max_lng float8, max_lat float8)
returns setof public.facilities language sql stable as $$
  select * from public.facilities
  where geom && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326);
$$;

-- K nearest facilities, optionally by category (GiST KNN <->)
create or replace function public.facilities_nearby(
  lng float8, lat float8, max_km float8 default 25,
  cat facility_category default null, lim int default 50)
returns table (like public.facilities, distance_m float8)
language sql stable as $$
  select f.*, st_distance(f.geom::geography,
         st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_m
  from public.facilities f
  where (cat is null or f.category = cat)
    and st_dwithin(f.geom::geography,
        st_setsrid(st_makepoint(lng, lat), 4326)::geography, max_km * 1000)
  order by f.geom <-> st_setsrid(st_makepoint(lng, lat), 4326)
  limit lim;
$$;

-- RLS: public read, open crowd reporting
alter table public.facilities enable row level security;
alter table public.facility_reports enable row level security;
alter table public.offline_regions enable row level security;
alter table public.alerts enable row level security;

create policy "public read facilities" on public.facilities for select using (true);
create policy "public read regions" on public.offline_regions for select using (true);
create policy "public read alerts" on public.alerts for select using (true);
create policy "public read reports" on public.facility_reports for select using (true);
create policy "anyone can report" on public.facility_reports for insert with check (true);
