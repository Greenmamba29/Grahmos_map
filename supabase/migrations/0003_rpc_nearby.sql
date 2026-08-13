-- Nearby facilities with distance, plus a bbox fetch used to prime the offline cache.

create or replace function public.facilities_nearby(
  in_lng          double precision,
  in_lat          double precision,
  in_radius_m     double precision default 25000,
  in_categories   facility_category[] default null,
  in_statuses     facility_status[] default null,
  in_min_capacity integer default null,
  in_limit        integer default 200
)
returns table (
  id uuid, name text, category facility_category, status facility_status,
  lng double precision, lat double precision, distance_m double precision,
  capacity integer, occupancy integer, resources jsonb,
  address text, contact_phone text, notes text,
  verified_at timestamptz, last_updated timestamptz
)
language sql stable as $$
  select f.id, f.name, f.category, f.status,
         st_x(f.geom::geometry), st_y(f.geom::geometry),
         st_distance(f.geom, st_point(in_lng, in_lat)::geography),
         f.capacity, f.occupancy, f.resources,
         f.address, f.contact_phone, f.notes, f.verified_at, f.last_updated
    from public.facilities f
   where st_dwithin(f.geom, st_point(in_lng, in_lat)::geography, in_radius_m)
     and (in_categories is null or f.category = any(in_categories))
     and (in_statuses   is null or f.status   = any(in_statuses))
     and (in_min_capacity is null or coalesce(f.capacity, 0) >= in_min_capacity)
   order by 7
   limit in_limit;
$$;

create or replace function public.facilities_in_bbox(
  min_lng double precision, min_lat double precision,
  max_lng double precision, max_lat double precision
)
returns setof public.facilities
language sql stable as $$
  select * from public.facilities
   where st_intersects(
     geom,
     st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
   );
$$;

grant execute on function public.facilities_nearby(
  double precision, double precision, double precision,
  facility_category[], facility_status[], integer, integer
) to anon, authenticated;

grant execute on function public.facilities_in_bbox(
  double precision, double precision, double precision, double precision
) to anon, authenticated;
