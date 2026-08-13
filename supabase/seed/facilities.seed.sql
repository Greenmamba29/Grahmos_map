-- Demo area of operations: Port-au-Prince metro.
-- Idempotent: re-running upserts on the stable seed UUIDs.

insert into public.facilities (
  id, name, category, geom, address, capacity, occupancy, status,
  resources, contact_phone, notes, verified_at, last_updated
) values
  (
    '11111111-1111-4111-a111-000000000001',
    'Hôpital Général Central', 'hospital',
    st_point(-72.3395, 18.5471)::geography,
    'Rue Monseigneur Guilloux, Port-au-Prince',
    480, 391, 'open',
    '{"power":"available","water":"low","oxygen":"available","beds":"low","medical":"available"}'::jsonb,
    '+509 2222 1000',
    'Trauma-capable. Generator fuel reserve approximately 36 hours.',
    now() - interval '2.5 hours', now() - interval '2.5 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000002',
    'Clinique Saint-Antoine', 'hospital',
    st_point(-72.3082, 18.5533)::geography,
    'Delmas 33, Port-au-Prince',
    90, 88, 'limited',
    '{"power":"low","water":"available","oxygen":"out","beds":"out","medical":"low"}'::jsonb,
    '+509 2812 4477',
    'Accepting referrals for stable patients only. No surgical capacity today.',
    now() - interval '6 hours', now() - interval '6 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000003',
    'Centre Médical Pétion-Ville', 'hospital',
    st_point(-72.2861, 18.5124)::geography,
    'Rue Faubert, Pétion-Ville',
    140, 72, 'open',
    '{"power":"available","water":"available","oxygen":"available","beds":"available","medical":"available"}'::jsonb,
    '+509 2941 8080',
    'Dialysis available. Helipad on site.',
    now() - interval '1 hour', now() - interval '1 hour'
  ),
  (
    '11111111-1111-4111-a111-000000000004',
    'Hôpital de Carrefour', 'hospital',
    st_point(-72.3985, 18.5341)::geography,
    'Route de Carrefour',
    120, 0, 'closed',
    '{"power":"out","water":"out","oxygen":"out","beds":"out","medical":"out"}'::jsonb,
    '+509 2813 2200',
    'Structural damage to the east wing. Patients transferred to Central.',
    now() - interval '9 hours', now() - interval '9 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000005',
    'Poste de Santé Croix-des-Bouquets', 'hospital',
    st_point(-72.2247, 18.5769)::geography,
    'Croix-des-Bouquets',
    45, 19, 'open',
    '{"power":"low","water":"available","oxygen":"low","beds":"available","medical":"available"}'::jsonb,
    null, null,
    now() - interval '4 hours', now() - interval '4 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000006',
    'Mobile Field Hospital — Champs de Mars', 'hospital',
    st_point(-72.3389, 18.5445)::geography,
    'Champs de Mars',
    60, 41, 'open',
    '{"power":"available","water":"available","oxygen":"available","beds":"low","medical":"available"}'::jsonb,
    null,
    'Deployed 3 days ago. Triage tent at the north entrance.',
    now() - interval '30 minutes', now() - interval '30 minutes'
  ),
  (
    '11111111-1111-4111-a111-000000000011',
    'Lycée Toussaint Louverture Shelter', 'shelter',
    st_point(-72.3301, 18.5406)::geography,
    'Avenue Christophe',
    1200, 860, 'open',
    '{"water":"available","food":"low","power":"low","medical":"low"}'::jsonb,
    '+509 3701 5522',
    'Family units in the gymnasium. Wheelchair accessible entrance on the west side.',
    now() - interval '1.5 hours', now() - interval '1.5 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000012',
    'Stade Sylvio Cator Shelter', 'shelter',
    st_point(-72.3452, 18.5361)::geography,
    'Rue Oswald Durand',
    2500, 2480, 'limited',
    '{"water":"low","food":"out","power":"available","medical":"out"}'::jsonb,
    null,
    'At capacity. Redirecting arrivals to Delmas 75.',
    now() - interval '3 hours', now() - interval '3 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000013',
    'Église Sacré-Coeur Shelter', 'shelter',
    st_point(-72.2977, 18.5301)::geography,
    'Turgeau',
    400, 155, 'open',
    '{"water":"available","food":"available","power":"low"}'::jsonb,
    null, null,
    now() - interval '5 hours', now() - interval '5 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000014',
    'Delmas 75 Community Shelter', 'shelter',
    st_point(-72.2919, 18.5478)::geography,
    'Delmas 75',
    900, 210, 'open',
    '{"water":"available","food":"available","power":"available","medical":"low"}'::jsonb,
    '+509 3455 1190',
    'Newly opened. Generator on site, 200 cots available.',
    now() - interval '45 minutes', now() - interval '45 minutes'
  ),
  (
    '11111111-1111-4111-a111-000000000015',
    'Carrefour Municipal Shelter', 'shelter',
    st_point(-72.4064, 18.5397)::geography,
    'Carrefour centre',
    600, null, 'unknown',
    '{}'::jsonb,
    null,
    'No contact since the outage began. Needs assessment.',
    null, now() - interval '31 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000016',
    'Tabarre Sports Complex Shelter', 'shelter',
    st_point(-72.2688, 18.5735)::geography,
    'Tabarre',
    1500, 640, 'open',
    '{"water":"available","food":"low","power":"available"}'::jsonb,
    null, null,
    now() - interval '2 hours', now() - interval '2 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000021',
    'École Nationale de Bel-Air', 'school',
    st_point(-72.3358, 18.5512)::geography,
    'Bel-Air',
    700, null, 'closed',
    '{"water":"low","power":"out"}'::jsonb,
    null,
    'Closed for structural inspection. Candidate shelter site once cleared.',
    now() - interval '12 hours', now() - interval '12 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000022',
    'Collège Saint-Pierre', 'school',
    st_point(-72.2895, 18.5145)::geography,
    'Pétion-Ville',
    850, 120, 'open',
    '{"water":"available","power":"available","food":"available"}'::jsonb,
    null,
    'Operating as a daytime child-friendly space.',
    now() - interval '3.5 hours', now() - interval '3.5 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000023',
    'Lycée de Croix-des-Bouquets', 'school',
    st_point(-72.2265, 18.5751)::geography,
    null, 620, 300, 'limited',
    '{"water":"low","power":"low"}'::jsonb,
    null, null,
    now() - interval '7 hours', now() - interval '7 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000024',
    'École Primaire de Delmas 31', 'school',
    st_point(-72.3055, 18.5471)::geography,
    null, 380, 45, 'open',
    '{"water":"available","power":"low"}'::jsonb,
    null, null,
    now() - interval '8 hours', now() - interval '8 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000025',
    'Institut Technique de Tabarre', 'school',
    st_point(-72.2731, 18.5806)::geography,
    null, 540, null, 'unknown',
    '{}'::jsonb,
    null, null,
    null, now() - interval '40 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000031',
    'DINEPA Water Point — Bel-Air', 'water',
    st_point(-72.3372, 18.5489)::geography,
    null, 8000, null, 'open',
    '{"water":"available","power":"low"}'::jsonb,
    null,
    'Chlorinated. 8,000 L/day. Queue managed 06:00–18:00.',
    now() - interval '1.25 hours', now() - interval '1.25 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000032',
    'Borehole — Delmas 48', 'water',
    st_point(-72.3011, 18.5512)::geography,
    null, 5000, null, 'limited',
    '{"water":"low","power":"out"}'::jsonb,
    null,
    'Hand pump only while the pump generator is out of fuel.',
    now() - interval '4.5 hours', now() - interval '4.5 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000033',
    'Water Treatment Unit — Cité Soleil', 'water',
    st_point(-72.3269, 18.5788)::geography,
    null, 20000, null, 'open',
    '{"water":"available","power":"available","fuel":"low"}'::jsonb,
    '+509 3690 7788', null,
    now() - interval '2.25 hours', now() - interval '2.25 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000034',
    'Spring Catchment — Kenscoff Road', 'water',
    st_point(-72.2874, 18.4741)::geography,
    null, 3000, null, 'open',
    '{"water":"available"}'::jsonb,
    null,
    'Untreated. Boil before drinking. Steep approach, 4x4 only.',
    now() - interval '14 hours', now() - interval '14 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000035',
    'Tanker Filling Station — Port', 'water',
    st_point(-72.3428, 18.5583)::geography,
    null, 40000, null, 'closed',
    '{"water":"out","power":"out"}'::jsonb,
    null,
    'Access road flooded. Reassess after the water level drops.',
    now() - interval '5.5 hours', now() - interval '5.5 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000036',
    'Community Cistern — Carrefour', 'water',
    st_point(-72.3941, 18.5372)::geography,
    null, 12000, null, 'limited',
    '{"water":"low"}'::jsonb,
    null, null,
    now() - interval '10 hours', now() - interval '10 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000041',
    'EDH Substation — Delmas', 'power',
    st_point(-72.3138, 18.5449)::geography,
    null, null, null, 'limited',
    '{"power":"low","fuel":"low"}'::jsonb,
    null,
    'Rolling supply, roughly 6 hours per day in this sector.',
    now() - interval '3.25 hours', now() - interval '3.25 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000042',
    'Solar Microgrid — Tabarre', 'power',
    st_point(-72.2704, 18.5691)::geography,
    null, 250, null, 'open',
    '{"power":"available"}'::jsonb,
    null,
    'Public charging bay for radios and phones, 08:00–17:00.',
    now() - interval '1.75 hours', now() - interval '1.75 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000043',
    'Generator Depot — Airport Road', 'power',
    st_point(-72.2925, 18.5771)::geography,
    null, null, null, 'open',
    '{"power":"available","fuel":"available"}'::jsonb,
    '+509 2813 9001', null,
    now() - interval '2.75 hours', now() - interval '2.75 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000044',
    'EDH Substation — Carrefour', 'power',
    st_point(-72.4021, 18.5314)::geography,
    null, null, null, 'closed',
    '{"power":"out"}'::jsonb,
    null,
    'Transformer failure. No restoration estimate.',
    now() - interval '16 hours', now() - interval '16 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000051',
    'Comms Tower — Boutilliers Ridge', 'comms',
    st_point(-72.3218, 18.4924)::geography,
    null, null, null, 'open',
    '{"power":"available","fuel":"low"}'::jsonb,
    null,
    'VHF repeater plus backhaul. Elevation 890 m, line of sight to the bay.',
    now() - interval '2 hours', now() - interval '2 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000052',
    'Comms Tower — Delmas 60', 'comms',
    st_point(-72.2966, 18.5424)::geography,
    null, null, null, 'limited',
    '{"power":"low","fuel":"out"}'::jsonb,
    null,
    'Running on battery. Approximately 8 hours of backup remaining.',
    now() - interval '1.1 hours', now() - interval '1.1 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000053',
    'Satellite Uplink — Logistics Base', 'comms',
    st_point(-72.2864, 18.5807)::geography,
    null, null, null, 'open',
    '{"power":"available","fuel":"available"}'::jsonb,
    '+509 3777 4040',
    'BGAN terminals available for coordination traffic.',
    now() - interval '15 minutes', now() - interval '15 minutes'
  ),
  (
    '11111111-1111-4111-a111-000000000054',
    'Comms Tower — Croix-des-Bouquets', 'comms',
    st_point(-72.2183, 18.5822)::geography,
    null, null, null, 'unknown',
    '{}'::jsonb,
    null,
    'Unreachable since 04:00. Physical check required.',
    null, now() - interval '28 hours'
  ),
  (
    '11111111-1111-4111-a111-000000000055',
    'Emergency Radio Room — City Hall', 'comms',
    st_point(-72.3411, 18.5426)::geography,
    null, null, null, 'open',
    '{"power":"available"}'::jsonb,
    null,
    'Staffed 24/7. Primary coordination net on channel 3.',
    now() - interval '24 minutes', now() - interval '24 minutes'
  )
on conflict (id) do update set
  name          = excluded.name,
  category      = excluded.category,
  geom          = excluded.geom,
  address       = excluded.address,
  capacity      = excluded.capacity,
  occupancy     = excluded.occupancy,
  status        = excluded.status,
  resources     = excluded.resources,
  contact_phone = excluded.contact_phone,
  notes         = excluded.notes,
  verified_at   = excluded.verified_at,
  last_updated  = excluded.last_updated;

insert into public.hazards (
  id, kind, severity, geom, lng, lat, radius_m, description, reported_at, expires_at
) values
  (
    '22222222-2222-4222-a222-000000000001',
    'flood', 4,
    st_buffer(st_point(-72.3446, 18.5606)::geography, 900),
    -72.3446, 18.5606, 900,
    'Port access road under 60 cm of water. Impassable to light vehicles.',
    now() - interval '3 hours', now() + interval '21 hours'
  ),
  (
    '22222222-2222-4222-a222-000000000002',
    'landslide', 5,
    st_buffer(st_point(-72.3062, 18.4988)::geography, 550),
    -72.3062, 18.4988, 550,
    'Hillside collapse across the Kenscoff road switchbacks.',
    now() - interval '11 hours', null
  ),
  (
    '22222222-2222-4222-a222-000000000003',
    'blocked_road', 3,
    st_buffer(st_point(-72.3184, 18.5527)::geography, 400),
    -72.3184, 18.5527, 400,
    'Debris and a downed pole narrowing the carriageway to one lane.',
    now() - interval '6 hours', now() + interval '12 hours'
  ),
  (
    '22222222-2222-4222-a222-000000000004',
    'outage', 2,
    st_buffer(st_point(-72.3999, 18.5352)::geography, 2600),
    -72.3999, 18.5352, 2600,
    'Grid down across Carrefour. No street lighting after dark.',
    now() - interval '18 hours', null
  ),
  (
    '22222222-2222-4222-a222-000000000005',
    'conflict', 4,
    st_buffer(st_point(-72.3311, 18.5661)::geography, 1100),
    -72.3311, 18.5661, 1100,
    'Movement restricted. Coordinate with the security cell before transit.',
    now() - interval '2 hours', now() + interval '10 hours'
  ),
  (
    '22222222-2222-4222-a222-000000000006',
    'fire', 3,
    st_buffer(st_point(-72.2809, 18.5586)::geography, 350),
    -72.2809, 18.5586, 350,
    'Warehouse fire, smoke plume drifting east.',
    now() - interval '1.5 hours', now() + interval '6 hours'
  )
on conflict (id) do update set
  kind        = excluded.kind,
  severity    = excluded.severity,
  geom        = excluded.geom,
  lng         = excluded.lng,
  lat         = excluded.lat,
  radius_m    = excluded.radius_m,
  description = excluded.description,
  reported_at = excluded.reported_at,
  expires_at  = excluded.expires_at;
