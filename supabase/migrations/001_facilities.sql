-- Resilience Maps — facilities schema (PostGIS)
create extension if not exists postgis;
create extension if not exists pg_trgm;

do $$ begin
  create type facility_category as enum (
    'hospital', 'school', 'shelter', 'water', 'power', 'comms'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type facility_status as enum (
    'open', 'limited', 'closed', 'unknown'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category facility_category not null,
  status facility_status not null default 'unknown',
  capacity integer,
  capacity_unit text,
  phone text,
  website text,
  address text,
  resources jsonb default '[]'::jsonb,
  notes text,
  geom geometry(Point, 4326) not null,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists facilities_geom_gix on public.facilities using gist (geom);
create index if not exists facilities_category_idx on public.facilities (category);
create index if not exists facilities_status_idx on public.facilities (status);
create index if not exists facilities_name_trgm on public.facilities using gin (name gin_trgm_ops);

create or replace function public.nearby_facilities(
  lat double precision,
  lng double precision,
  radius_m double precision default 5000,
  categories facility_category[] default null
)
returns table (
  id uuid,
  name text,
  category facility_category,
  status facility_status,
  capacity integer,
  capacity_unit text,
  phone text,
  address text,
  resources jsonb,
  last_updated timestamptz,
  distance_m double precision,
  lng double precision,
  lat double precision
)
language sql
stable
as $$
  select
    f.id,
    f.name,
    f.category,
    f.status,
    f.capacity,
    f.capacity_unit,
    f.phone,
    f.address,
    f.resources,
    f.last_updated,
    st_distance(
      f.geom::geography,
      st_setsrid(st_makepoint(lng, lat), 4326)::geography
    ) as distance_m,
    st_x(f.geom) as lng,
    st_y(f.geom) as lat
  from public.facilities f
  where st_dwithin(
    f.geom::geography,
    st_setsrid(st_makepoint(lng, lat), 4326)::geography,
    radius_m
  )
  and (categories is null or f.category = any (categories))
  order by distance_m;
$$;

create table if not exists public.offline_regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bbox geometry(Polygon, 4326) not null,
  min_zoom int not null default 0,
  max_zoom int not null default 14,
  size_bytes bigint,
  pmtiles_url text,
  created_at timestamptz not null default now()
);

alter table public.facilities enable row level security;

drop policy if exists "Public read facilities" on public.facilities;
create policy "Public read facilities"
  on public.facilities for select
  using (true);

drop policy if exists "Auth update status" on public.facilities;
create policy "Auth update status"
  on public.facilities for update
  to authenticated
  using (true)
  with check (true);
