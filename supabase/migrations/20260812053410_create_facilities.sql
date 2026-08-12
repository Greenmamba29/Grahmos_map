create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create type public.facility_category as enum (
  'hospital',
  'school',
  'shelter',
  'water',
  'power',
  'communications'
);

create type public.facility_status as enum (
  'operational',
  'limited',
  'closed',
  'unknown'
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual',
  source_id text,
  name text not null check (length(name) between 1 and 240),
  category public.facility_category not null,
  geom extensions.geography(Point, 4326) not null,
  capacity integer check (capacity is null or capacity >= 0),
  status public.facility_status not null default 'unknown',
  phone text,
  address text,
  resources jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

comment on table public.facilities is
  'Read-only public catalog of critical infrastructure synchronized for offline use.';
comment on column public.facilities.geom is
  'WGS84 location stored as geography for meter-based distance queries.';

create index facilities_geom_gix on public.facilities using gist (geom);
create index facilities_category_status_idx
  on public.facilities (category, status);
create index facilities_last_updated_idx
  on public.facilities (last_updated desc);

alter table public.facilities enable row level security;

create policy "Public facilities are readable"
  on public.facilities
  for select
  to anon, authenticated
  using (true);

revoke all on table public.facilities from anon, authenticated;
grant select on table public.facilities to anon, authenticated;

create or replace function public.nearby_facilities(
  search_latitude double precision,
  search_longitude double precision,
  radius_meters double precision default 50000,
  result_limit integer default 250
)
returns table (
  id uuid,
  name text,
  category public.facility_category,
  longitude double precision,
  latitude double precision,
  capacity integer,
  status public.facility_status,
  phone text,
  address text,
  resources jsonb,
  is_verified boolean,
  last_updated timestamptz,
  distance_meters double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    facility.id,
    facility.name,
    facility.category,
    extensions.st_x(facility.geom::extensions.geometry) as longitude,
    extensions.st_y(facility.geom::extensions.geometry) as latitude,
    facility.capacity,
    facility.status,
    facility.phone,
    facility.address,
    facility.resources,
    facility.is_verified,
    facility.last_updated,
    extensions.st_distance(
      facility.geom,
      extensions.st_setsrid(
        extensions.st_makepoint(search_longitude, search_latitude),
        4326
      )::extensions.geography
    ) as distance_meters
  from public.facilities as facility
  where extensions.st_dwithin(
    facility.geom,
    extensions.st_setsrid(
      extensions.st_makepoint(search_longitude, search_latitude),
      4326
    )::extensions.geography,
    least(greatest(radius_meters, 0), 200000)
  )
  order by facility.geom operator(extensions.<->) extensions.st_setsrid(
    extensions.st_makepoint(search_longitude, search_latitude),
    4326
  )::extensions.geography
  limit least(greatest(result_limit, 1), 1000);
$$;

revoke all on function public.nearby_facilities(
  double precision,
  double precision,
  double precision,
  integer
) from public;
grant execute on function public.nearby_facilities(
  double precision,
  double precision,
  double precision,
  integer
) to anon, authenticated;
