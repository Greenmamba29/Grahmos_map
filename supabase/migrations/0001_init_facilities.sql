-- Resilience Maps — initial schema
-- See INSTALLATION_GUIDE.md §5 for full context.

create extension if not exists postgis;
create extension if not exists "pgcrypto";

create type facility_category as enum (
  'hospital', 'school', 'shelter', 'water', 'power', 'comms'
);

create type facility_status as enum (
  'operational', 'limited', 'offline', 'unknown'
);

create table if not exists facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category facility_category not null,
  geom geometry(Point, 4326) not null,
  address text,
  capacity integer,
  capacity_unit text default 'people',
  occupancy integer,
  status facility_status not null default 'unknown',
  resources jsonb not null default '[]'::jsonb,
  contact_phone text,
  description text,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists facilities_geom_idx on facilities using gist (geom);
create index if not exists facilities_category_idx on facilities (category);
create index if not exists facilities_status_idx on facilities (status);

create table if not exists status_reports (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities (id) on delete cascade,
  reported_status facility_status not null,
  note text,
  reporter_device_id text,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

create index if not exists status_reports_facility_idx on status_reports (facility_id);

create table if not exists offline_regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bbox geometry(Polygon, 4326) not null,
  min_zoom integer not null default 0,
  max_zoom integer not null default 14,
  categories facility_category[] not null default '{}',
  size_estimate_mb numeric,
  created_at timestamptz not null default now()
);

-- Keep `last_updated` fresh whenever a facility row changes.
create or replace function set_facility_last_updated()
returns trigger
language plpgsql
as $$
begin
  new.last_updated = now();
  return new;
end;
$$;

drop trigger if exists trg_facilities_last_updated on facilities;
create trigger trg_facilities_last_updated
  before update on facilities
  for each row
  execute function set_facility_last_updated();

-- Geospatial RPC: facilities within radius (meters) of a point, optional
-- category filter. Backs the Explore/Search/Filter screens.
create or replace function facilities_within_radius(
  center_lng double precision,
  center_lat double precision,
  radius_m double precision,
  categories facility_category[] default null
)
returns setof facilities
language sql stable
as $$
  select f.*
  from facilities f
  where ST_DWithin(
    f.geom::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_m
  )
  and (categories is null or f.category = any(categories))
  order by ST_Distance(
    f.geom::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
  );
$$;

alter table facilities enable row level security;
alter table status_reports enable row level security;
alter table offline_regions enable row level security;

create policy "Public read access to facilities"
  on facilities for select using (true);

create policy "Public read access to status reports"
  on status_reports for select using (true);

create policy "Public insert of status reports"
  on status_reports for insert with check (true);

create policy "Public read access to offline regions"
  on offline_regions for select using (true);
