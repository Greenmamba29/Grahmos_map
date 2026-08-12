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
  name text not null check (char_length(name) between 1 and 200),
  category public.facility_category not null,
  geom extensions.geography(point, 4326) not null,
  capacity integer check (capacity is null or capacity >= 0),
  status public.facility_status not null default 'unknown',
  address text,
  phone text,
  resources jsonb not null default '{}'::jsonb
    check (jsonb_typeof(resources) = 'object'),
  source text,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.facilities is
  'Critical infrastructure locations and their latest moderated status.';
comment on column public.facilities.geom is
  'WGS84 point stored as longitude, latitude.';
comment on column public.facilities.resources is
  'Non-sensitive facility resources such as water, beds, and backup power.';

create index facilities_geom_gix
  on public.facilities
  using gist (geom);

create index facilities_category_status_idx
  on public.facilities (category, status);

create index facilities_last_updated_idx
  on public.facilities (last_updated desc);

alter table public.facilities enable row level security;

create policy "Public can read facilities"
  on public.facilities
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate, references, trigger
  on public.facilities
  from anon, authenticated;

grant select on public.facilities to anon, authenticated;

create or replace function public.facilities_in_view(
  min_lat double precision,
  min_long double precision,
  max_lat double precision,
  max_long double precision,
  requested_categories public.facility_category[] default null,
  result_limit integer default 500
)
returns table (
  id uuid,
  name text,
  category public.facility_category,
  status public.facility_status,
  capacity integer,
  longitude double precision,
  latitude double precision,
  address text,
  last_updated timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    facility.id,
    facility.name,
    facility.category,
    facility.status,
    facility.capacity,
    extensions.st_x(facility.geom::extensions.geometry) as longitude,
    extensions.st_y(facility.geom::extensions.geometry) as latitude,
    facility.address,
    facility.last_updated
  from public.facilities as facility
  where
    min_lat between -90 and 90
    and max_lat between -90 and 90
    and min_long between -180 and 180
    and max_long between -180 and 180
    and min_lat <= max_lat
    and min_long <= max_long
    and facility.geom operator(extensions.&&)
      extensions.st_makeenvelope(
        min_long,
        min_lat,
        max_long,
        max_lat,
        4326
      )::extensions.geography
    and (
      requested_categories is null
      or facility.category = any(requested_categories)
    )
  order by facility.last_updated desc
  limit least(greatest(coalesce(result_limit, 500), 1), 2000);
$$;

revoke all on function public.facilities_in_view(
  double precision,
  double precision,
  double precision,
  double precision,
  public.facility_category[],
  integer
) from public;

grant execute on function public.facilities_in_view(
  double precision,
  double precision,
  double precision,
  double precision,
  public.facility_category[],
  integer
) to anon, authenticated;
