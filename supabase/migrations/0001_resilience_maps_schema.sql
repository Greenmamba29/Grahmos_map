create extension if not exists postgis with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'facility_category') then
    create type public.facility_category as enum (
      'hospital',
      'school',
      'shelter',
      'water',
      'power',
      'comms'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'facility_status') then
    create type public.facility_status as enum (
      'operational',
      'limited',
      'closed',
      'unknown'
    );
  end if;
end $$;

create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.facility_category not null,
  geom extensions.geography(point, 4326) not null,
  address text,
  phone text,
  capacity integer,
  status public.facility_status not null default 'unknown',
  resources jsonb not null default '{}'::jsonb,
  source text,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists facilities_geom_gix on public.facilities using gist (geom);
create index if not exists facilities_category_idx on public.facilities (category);
create index if not exists facilities_status_idx on public.facilities (status);
create index if not exists facilities_last_updated_idx on public.facilities (last_updated desc);

alter table public.facilities enable row level security;

drop policy if exists "Public can read facilities" on public.facilities;
create policy "Public can read facilities"
  on public.facilities
  for select
  to anon, authenticated
  using (true);

create or replace function public.facilities_in_view(
  min_lat float,
  min_long float,
  max_lat float,
  max_long float,
  categories public.facility_category[] default null
)
returns table (
  id uuid,
  name text,
  category public.facility_category,
  status public.facility_status,
  capacity integer,
  resources jsonb,
  phone text,
  last_updated timestamptz,
  lat float,
  long float
)
set search_path = ''
language sql
stable
as $$
  select
    f.id,
    f.name,
    f.category,
    f.status,
    f.capacity,
    f.resources,
    f.phone,
    f.last_updated,
    extensions.st_y(f.geom::extensions.geometry) as lat,
    extensions.st_x(f.geom::extensions.geometry) as long
  from public.facilities f
  where f.geom operator(extensions.&&) extensions.st_setsrid(
    extensions.st_makebox2d(
      extensions.st_point(min_long, min_lat),
      extensions.st_point(max_long, max_lat)
    ),
    4326
  )::extensions.geography
  and (categories is null or f.category = any(categories));
$$;

create or replace function public.nearby_facilities(
  lat float,
  long float,
  radius_meters integer default 25000,
  categories public.facility_category[] default null
)
returns table (
  id uuid,
  name text,
  category public.facility_category,
  status public.facility_status,
  capacity integer,
  resources jsonb,
  phone text,
  last_updated timestamptz,
  facility_lat float,
  facility_long float,
  dist_meters float
)
set search_path = ''
language sql
stable
as $$
  select
    f.id,
    f.name,
    f.category,
    f.status,
    f.capacity,
    f.resources,
    f.phone,
    f.last_updated,
    extensions.st_y(f.geom::extensions.geometry) as facility_lat,
    extensions.st_x(f.geom::extensions.geometry) as facility_long,
    extensions.st_distance(f.geom, extensions.st_point(long, lat)::extensions.geography) as dist_meters
  from public.facilities f
  where extensions.st_dwithin(f.geom, extensions.st_point(long, lat)::extensions.geography, radius_meters)
  and (categories is null or f.category = any(categories))
  order by f.geom operator(extensions.<->) extensions.st_point(long, lat)::extensions.geography;
$$;
