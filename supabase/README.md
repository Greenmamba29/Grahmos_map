# Supabase setup

This folder contains the Resilience Maps PostGIS schema.

Run locally:

```bash
supabase start
supabase migration up
```

The migration enables PostGIS, creates `public.facilities`, adds spatial indexes, enables RLS, and exposes read-only viewport/nearby RPC helpers.
