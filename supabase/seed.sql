-- Sample facility rows for local development. Mirrors src/data/mockFacilities.ts
-- so the UI looks the same whether backed by Supabase or the offline fixture.

insert into facilities (name, category, geom, address, capacity, capacity_unit, occupancy, status, resources, contact_phone, description)
values
  ('St. Francis Memorial Hospital', 'hospital', ST_SetSRID(ST_MakePoint(-122.4177, 37.7857), 4326), '900 Hyde St, San Francisco', 240, 'beds', 198, 'operational', '["Emergency Care","Surgery","ICU","Generator Backup"]', '+1-415-555-0110', 'Level II trauma center with full emergency services.'),
  ('Zuckerberg SF General', 'hospital', ST_SetSRID(ST_MakePoint(-122.4058, 37.7556), 4326), '1001 Potrero Ave, San Francisco', 284, 'beds', 260, 'limited', '["Emergency Care","Trauma Center","Blood Bank"]', '+1-415-555-0111', 'County trauma center, currently at high capacity.'),
  ('Mission High School', 'school', ST_SetSRID(ST_MakePoint(-122.4276, 37.7648), 4326), '3750 18th St, San Francisco', 900, 'students', null, 'operational', '["Gymnasium","Cafeteria","Backup Generator"]', null, 'Designated community emergency assembly point.'),
  ('Moscone Center Emergency Shelter', 'shelter', ST_SetSRID(ST_MakePoint(-122.4016, 37.7841), 4326), '747 Howard St, San Francisco', 1200, 'people', 340, 'operational', '["Cots","Meals","Medical Tent","Pet Area","Wi-Fi"]', '+1-415-555-0122', 'Primary Red Cross emergency shelter for downtown SF.'),
  ('Lake Merced Water Treatment', 'water', ST_SetSRID(ST_MakePoint(-122.4863, 37.7218), 4326), '1 Lake Merced Blvd, San Francisco', 50000, 'liters/day', null, 'operational', '["Potable Water Distribution","Water Testing"]', null, null),
  ('Potrero Power Substation', 'power', ST_SetSRID(ST_MakePoint(-122.3886, 37.7583), 4326), '1201 Illinois St, San Francisco', 120, 'MW', null, 'limited', '["Grid Substation","Backup Diesel"]', null, null),
  ('Sutro Tower', 'comms', ST_SetSRID(ST_MakePoint(-122.4529, 37.7552), 4326), '1 Sutro Tower Ln, San Francisco', null, 'people', null, 'operational', '["Broadcast Relay","Emergency Radio Repeater"]', null, null)
on conflict do nothing;
