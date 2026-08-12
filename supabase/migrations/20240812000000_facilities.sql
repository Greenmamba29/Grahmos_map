-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Facility category enum
CREATE TYPE facility_category AS ENUM (
  'hospital',
  'school',
  'shelter',
  'water',
  'power',
  'comms'
);

-- Facility status enum
CREATE TYPE facility_status AS ENUM (
  'operational',
  'limited',
  'closed',
  'unknown'
);

-- Facilities table
CREATE TABLE facilities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  category      facility_category NOT NULL,
  status        facility_status NOT NULL DEFAULT 'unknown',
  capacity      INTEGER,
  capacity_unit TEXT,
  phone         TEXT,
  website       TEXT,
  description   TEXT,
  resources     JSONB DEFAULT '[]',
  geom          GEOGRAPHY(POINT, 4326) NOT NULL,
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX facilities_geom_idx ON facilities USING GIST (geom);
CREATE INDEX facilities_category_idx ON facilities (category);
CREATE INDEX facilities_status_idx ON facilities (status);

-- Row Level Security
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON facilities FOR SELECT
  USING (true);

CREATE POLICY "Authenticated insert"
  ON facilities FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update"
  ON facilities FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Geospatial nearby query
CREATE OR REPLACE FUNCTION facilities_nearby(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 5000,
  categories facility_category[] DEFAULT NULL,
  min_capacity INTEGER DEFAULT NULL,
  facility_statuses facility_status[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category facility_category,
  status facility_status,
  capacity INTEGER,
  capacity_unit TEXT,
  phone TEXT,
  website TEXT,
  description TEXT,
  resources JSONB,
  last_updated TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    f.id,
    f.name,
    f.category,
    f.status,
    f.capacity,
    f.capacity_unit,
    f.phone,
    f.website,
    f.description,
    f.resources,
    f.last_updated
  FROM facilities f
  WHERE ST_DWithin(
    f.geom,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  )
  AND (categories IS NULL OR f.category = ANY(categories))
  AND (min_capacity IS NULL OR f.capacity >= min_capacity)
  AND (facility_statuses IS NULL OR f.status = ANY(facility_statuses))
  ORDER BY ST_Distance(f.geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography);
$$;

-- Seed data (Fort Collins, CO area)
INSERT INTO facilities (name, category, status, capacity, capacity_unit, phone, geom) VALUES
  ('Central Memorial Hospital', 'hospital', 'operational', 250, 'beds', '+1-555-0100',
   ST_SetSRID(ST_MakePoint(-105.2705, 40.0150), 4326)::geography),
  ('Lincoln Elementary', 'school', 'operational', 400, 'seats', '+1-555-0101',
   ST_SetSRID(ST_MakePoint(-105.2800, 40.0200), 4326)::geography),
  ('Community Shelter A', 'shelter', 'limited', 150, 'seats', '+1-555-0102',
   ST_SetSRID(ST_MakePoint(-105.2600, 40.0100), 4326)::geography),
  ('Municipal Water Plant', 'water', 'operational', 50000, 'gallons', '+1-555-0103',
   ST_SetSRID(ST_MakePoint(-105.2500, 40.0050), 4326)::geography),
  ('Tower Ridge Comms', 'comms', 'operational', NULL, NULL, '+1-555-0104',
   ST_SetSRID(ST_MakePoint(-105.2900, 40.0250), 4326)::geography);
