/**
 * Apply supabase/seed/facilities.seed.sql to a linked database.
 *
 *   SUPABASE_DB_URL=postgres://… npm run seed
 *
 * The SQL file is the source of truth (stable UUIDs, idempotent upserts).
 * This wrapper just locates it and runs psql.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dbUrl = process.env.SUPABASE_DB_URL ?? '';
const sqlPath = join(dirname(fileURLToPath(import.meta.url)), '../supabase/seed/facilities.seed.sql');

if (!dbUrl) {
  console.error(`Set SUPABASE_DB_URL, then rerun:

  SUPABASE_DB_URL=postgres://… npm run seed

Or apply the file directly:

  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f ${sqlPath}
`);
  process.exit(1);
}

const result = spawnSync(
  'psql',
  [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlPath],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error('Failed to launch psql:', result.error.message);
  console.error(`Apply the seed manually:\n  psql "$SUPABASE_DB_URL" -f ${sqlPath}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
