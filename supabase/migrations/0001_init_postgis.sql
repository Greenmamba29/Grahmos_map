-- Enable PostGIS and trigram search. Run first.

create extension if not exists postgis;
create extension if not exists pg_trgm;
