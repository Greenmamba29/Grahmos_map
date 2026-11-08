#!/usr/bin/env node
// Parity harness: proves a TypeScript port behaves exactly like the original (Rust, C#, Go, Python...).
// Differential testing: both implementations get the same inputs; outputs must match.
//
//   node osa-kit/adapter/parity.mjs --fixtures parity/slugify.fixtures.json \
//        --ref "./target/release/slugify"  --port "node parity/slugify.port.ts"
//   node osa-kit/adapter/parity.mjs --fixtures f.json --ref "<cmd>" --record parity/slugify.golden.json
//   node osa-kit/adapter/parity.mjs --golden parity/slugify.golden.json --port "node parity/slugify.port.ts"
//
// Protocol: each command reads ONE fixture input on stdin (JSON) and prints ONE result on stdout.
// Record the reference once (where the original toolchain exists, e.g. CI); the golden file then lets
// the Lovable project re-check the port forever with Node only.
// Fixtures: [{ "name": "...", "input": <any JSON> }, ...]. Floats compare with --tolerance (default 1e-9).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const a = process.argv.slice(2);
const opt = (k) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : undefined; };
const tol = Number(opt("tolerance") ?? 1e-9);

function exec(cmd, input) {
  const r = spawnSync("sh", ["-c", cmd], { input: JSON.stringify(input), encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) return { error: `exit ${r.status}: ${(r.stderr || "").trim().slice(0, 200)}` };
  const out = r.stdout.trim();
  try { return { value: JSON.parse(out) }; } catch { return { value: out }; }
}
function same(x, y) {
  if (typeof x === "number" && typeof y === "number") return Math.abs(x - y) <= tol * Math.max(1, Math.abs(x));
  if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((v, i) => same(v, y[i]));
  if (x && y && typeof x === "object" && typeof y === "object") {
    const kx = Object.keys(x).sort(), ky = Object.keys(y).sort();
    return same(kx, ky) && kx.every((k) => same(x[k], y[k]));
  }
  return x === y;
}

let cases;
if (opt("golden")) cases = JSON.parse(readFileSync(opt("golden"), "utf8"));
else {
  const fixtures = JSON.parse(readFileSync(opt("fixtures"), "utf8"));
  if (!opt("ref")) { console.error("--ref <cmd> (original) or --golden <file> required"); process.exit(2); }
  cases = fixtures.map((f) => ({ ...f, expected: exec(opt("ref"), f.input) }));
  // A reference that crashed recorded nothing about upstream: refuse, or verify fails forever and looks
  // like a port bug. Upstream behaviour that is an error must be printed as a JSON value by the runner.
  const broken = cases.filter((c) => c.expected.error);
  if (broken.length) {
    console.error(`reference failed on ${broken.length}/${cases.length} fixtures; no golden written. Make the runner print upstream errors as JSON values:`);
    for (const c of broken.slice(0, 10)) console.error(`  ${c.name}: ${c.expected.error}`);
    process.exit(1);
  }
  if (opt("record")) { mkdirSync(dirname(opt("record")), { recursive: true }); writeFileSync(opt("record"), JSON.stringify(cases, null, 2)); console.log(`recorded ${cases.length} reference outputs -> ${opt("record")}`); if (!opt("port")) process.exit(0); }
}
if (!opt("port")) { console.error("--port <cmd> required"); process.exit(2); }

let fails = 0;
for (const c of cases) {
  const got = exec(opt("port"), c.input);
  const ok = !got.error && !c.expected.error && same(c.expected.value, got.value);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}${ok ? "" : `\n      expected ${JSON.stringify(c.expected.value ?? c.expected.error)}\n      got      ${JSON.stringify(got.value ?? got.error)}`}`);
}
console.log(`\nparity ${cases.length - fails}/${cases.length}`);
process.exit(fails ? 1 : 0);
