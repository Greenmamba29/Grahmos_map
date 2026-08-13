-- Core registry: facilities, field reports, and hazard polygons.

create type facility_category as enum
  ('hospital','school','shelter','water','power','comms');

create type facility_status as enum
  ('open','limited','closed','unknown');

create table if not exists public.facilities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      facility_category not null,
  geom          geography(Point, 4326) not null,
  address       text,
  capacity      integer check (capacity is null or capacity >= 0),
  occupancy     integer check (occupancy is null or occupancy >= 0),
  status        facility_status not null default 'unknown',
  resources     jsonb not null default '{}'::jsonb,
  contact_phone text,
  notes         text,
  verified_at   timestamptz,
  last_updated  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index facilities_geom_idx     on public.facilities using gist (geom);
create index facilities_category_idx on public.facilities (category);
create index facilities_status_idx   on public.facilities (status);
create index facilities_name_trgm    on public.facilities using gin (name gin_trgm_ops);

create table if not exists public.facility_updates (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.facilities(id) on delete cascade,
  status       facility_status not null,
  capacity     integer,
  occupancy    integer,
  message      text,
  reporter     text,
  reported_at  timestamptz not null default now(),
  client_id    text unique
);
create index facility_updates_facility_idx
  on public.facility_updates (facility_id, reported_at desc);

create table if not exists public.hazards (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  severity    smallint not null default 1 check (severity between 1 and 5),
  geom        geography(Geometry, 4326) not null,
  lng         double precision,
  lat         double precision,
  radius_m    integer not null default 500,
  description text,
  reported_at timestamptz not null default now(),
  expires_at  timestamptz
);
create index hazards_geom_idx on public.hazards using gist (geom);

create or replace function public.apply_facility_update() returns trigger
language plpgsql as $$
begin
  update public.facilities
     set status       = new.status,
         capacity     = coalesce(new.capacity, capacity),
         occupancy    = coalesce(new.occupancy, occupancy),
         verified_at  = new.reported_at,
         last_updated = now()
   where id = new.facility_id;
  return new;
end $$;

drop trigger if exists facility_updates_apply on public.facility_updates;
create trigger facility_updates_apply
after insert on public.facility_updates
for each row execute function public.apply_facility_update();
