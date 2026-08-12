/**
 * Idempotently upserts the bundled mock facility fixture into a Supabase
 * project. Usage:
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-facilities.ts
 *
 * Requires the service role key (not the anon key) since it bypasses RLS
 * for inserts/upserts. Safe to re-run — rows are matched by `name`.
 */
import { createClient } from "@supabase/supabase-js";
import { MOCK_FACILITIES } from "../src/data/mockFacilities";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

async function main() {
  console.log(`Seeding ${MOCK_FACILITIES.length} facilities…`);

  for (const facility of MOCK_FACILITIES) {
    const { data: existing } = await supabase
      .from("facilities")
      .select("id")
      .eq("name", facility.name)
      .maybeSingle();

    const row = {
      name: facility.name,
      category: facility.category,
      geom: `SRID=4326;POINT(${facility.lng} ${facility.lat})`,
      address: facility.address,
      capacity: facility.capacity,
      capacity_unit: facility.capacityUnit,
      occupancy: facility.occupancy,
      status: facility.status,
      resources: facility.resources,
      contact_phone: facility.contactPhone,
      description: facility.description,
    };

    const { error } = existing
      ? await supabase.from("facilities").update(row).eq("id", existing.id)
      : await supabase.from("facilities").insert(row);

    if (error) {
      console.error(`Failed to seed ${facility.name}:`, error.message);
    } else {
      console.log(`${existing ? "Updated" : "Inserted"} ${facility.name}`);
    }
  }

  console.log("Done.");
}

main();
