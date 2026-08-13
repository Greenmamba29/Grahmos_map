-- Row-level security. Field reports are append-only from clients.

alter table public.facilities       enable row level security;
alter table public.facility_updates enable row level security;
alter table public.hazards          enable row level security;

drop policy if exists "facilities readable" on public.facilities;
drop policy if exists "hazards readable"    on public.hazards;
drop policy if exists "updates readable"    on public.facility_updates;
drop policy if exists "updates insertable"  on public.facility_updates;

create policy "facilities readable"
  on public.facilities for select using (true);

create policy "hazards readable"
  on public.hazards for select using (true);

create policy "updates readable"
  on public.facility_updates for select using (true);

-- Field reports are append-only from clients; edits require a service role.
create policy "updates insertable"
  on public.facility_updates for insert with check (true);
