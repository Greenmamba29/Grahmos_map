#!/usr/bin/env node
// Fails if a lockfile downloads packages from anywhere but the public npm registry.
// Why: Lovable's sandbox sometimes writes its private build-cache URL into bun.lock
// (e.g. https://europe-west1-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache/...). That mirror isn't ours:
// it can change or close at any time and has returned 403 outside Lovable. Found on Tollgate, Switchboard and
// the launchpad, 2026-10-01.
// Fix: in bun.lock set the URL field of each listed entry to "" (bun then uses the public registry; the
// sha512 integrity is unchanged because the tarballs are identical), then `bun install --frozen-lockfile`.
// Usage: node scripts/check-lockfile.mjs [lockfile...]   (default: bun.lock and package-lock.json if present)
import { existsSync, readFileSync } from "node:fs";

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["bun.lock", "package-lock.json"].filter((f) => existsSync(f));
if (!files.length) {
  console.log("check:lockfile: no lockfile found, nothing to check");
  process.exit(0);
}
const bad = [];
for (const f of files) {
  for (const u of readFileSync(f, "utf8").match(/https?:\/\/[^"\s]+\.tgz/g) ?? []) {
    if (!u.startsWith("https://registry.npmjs.org/")) bad.push(`${f}: ${u}`);
  }
}
if (bad.length) {
  console.error(
    `check:lockfile: ${bad.length} package URL(s) outside registry.npmjs.org:\n  ${bad.join("\n  ")}`,
  );
  console.error(
    'Fix: set each URL field to "" in bun.lock, then run `bun install --frozen-lockfile`.',
  );
  process.exit(1);
}
console.log(`check:lockfile: ${files.join(", ")} use the public npm registry only`);
