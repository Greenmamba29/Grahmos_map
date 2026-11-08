#!/usr/bin/env node
// REA — Reverse-Engineer As tests. The method is in osa-kit/rea/README.md; this is its tooling.
//
//   node osa-kit/rea/rea.mjs seams <repo>                 inventory outside-observable seams + classify the repo
//   node osa-kit/rea/rea.mjs characterize --fixtures f.json --ref "<upstream cmd>" --out golden.json
//   node osa-kit/rea/rea.mjs verify  --golden g.json --port "<port cmd>"
//   node osa-kit/rea/rea.mjs control --golden g.json --port "<port cmd>" --mutant "<deliberately wrong cmd>"
//
// characterize/verify delegate to osa-kit/adapter/parity.mjs (same stdin/stdout protocol).
// control is the negative control the kit already demands of every new test: the golden must pass the port
// AND fail a mutant. A golden that a wrong implementation also passes proves nothing.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const parity = join(here, "../adapter/parity.mjs");
const [cmd, ...rest] = process.argv.slice(2);
const opt = (k) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : undefined; };
const SKIP = new Set(["node_modules", ".git", "dist", "build", "vendor", "third_party", "3rdparty", ".venv", "target"]);

function walk(root, depth = 6, acc = []) {
  if (depth < 0) return acc;
  let names = [];
  try { names = readdirSync(root); } catch { return acc; }
  for (const n of names) {
    if (SKIP.has(n)) continue;
    const p = join(root, n);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, depth - 1, acc); else acc.push(p);
  }
  return acc;
}

function seams(repo) {
  const files = walk(repo).map((f) => relative(repo, f)).sort();
  const cli = [];
  for (const f of files.filter((x) => x.endsWith("package.json"))) {
    try {
      const pkg = JSON.parse(readFileSync(join(repo, f), "utf8"));
      const bin = typeof pkg.bin === "string" ? { [pkg.name]: pkg.bin } : pkg.bin || {};
      for (const [name, path] of Object.entries(bin)) cli.push({ name, from: f, entry: path, lang: "node" });
    } catch { /* malformed package.json is a finding for the gate, not for seams */ }
  }
  for (const f of files.filter((x) => x.endsWith("pyproject.toml"))) {
    const t = readFileSync(join(repo, f), "utf8");
    const block = t.split(/^\[project\.scripts\]\s*$/m)[1]?.split(/^\[/m)[0] ?? "";
    for (const m of block.matchAll(/^\s*([A-Za-z0-9_.-]+)\s*=\s*"([^"]+)"/gm)) cli.push({ name: m[1], from: f, entry: m[2], lang: "python" });
  }
  const openapi = files.filter((f) => /(^|\/)(openapi|swagger)[^/]*\.(ya?ml|json)$/i.test(f));
  const skills = files.filter((f) => /(^|\/)SKILL\.md$/.test(f)).map((f) => dirname(f));
  const mcp = files.filter((f) => /(^|\/)([a-z]+\.)?mcp\.json$/.test(f) || /(^|\/)\.mcp\.json$/.test(f));
  const plugins = files.filter((f) => /(^|\/)(\.claude-plugin|\.cursor-plugin|\.codex-plugin)\/(plugin|marketplace)\.json$/.test(f));
  const docker = files.filter((f) => /(^|\/)(Dockerfile[^/]*|docker-compose[^/]*\.ya?ml|compose\.ya?ml)$/.test(f));
  const native = files.filter((f) => /\.(c|cc|cpp|h|hpp)$/.test(f)).length;
  // Agents and hooks run with the user's permissions without a slash command; a root CLAUDE.md plus
  // .claude/settings.json makes the repo a project template (installs as its own repo, not into a workspace).
  const agents = files.filter((f) => /(^|\/)\.claude\/agents\/[^/]+\.md$/.test(f));
  const hooks = [];
  for (const f of files.filter((x) => /(^|\/)\.claude\/settings(\.local)?\.json$/.test(x))) {
    try {
      const cfg = JSON.parse(readFileSync(join(repo, f), "utf8"));
      for (const [event, groups] of Object.entries(cfg.hooks ?? {}))
        for (const g of groups ?? []) for (const h of g.hooks ?? []) if (h.command) hooks.push({ event, command: h.command });
    } catch { /* malformed settings is a finding for skill-scan */ }
  }
  const template = files.includes("CLAUDE.md") && files.includes(".claude/settings.json");
  const app = cli.length > 0 || openapi.length > 0 || docker.length > 0;
  const kind = skills.length && app ? "skill+app" : skills.length || plugins.length ? "skill" : app ? "app" : native ? "native" : "data";
  return { repo, kind, template, cli, openapi, skills, agents, hooks, mcp, plugins, docker, nativeSourceFiles: native };
}

function runParity(args) {
  return spawnSync("node", [parity, ...args], { encoding: "utf8" });
}

if (cmd === "seams") {
  const repo = rest[0];
  if (!repo || !existsSync(repo)) { console.error("usage: rea.mjs seams <repo>"); process.exit(2); }
  console.log(JSON.stringify(seams(repo), null, 2));
} else if (cmd === "characterize") {
  const r = runParity(["--fixtures", opt("fixtures"), "--ref", opt("ref"), "--record", opt("out")]);
  process.stdout.write(r.stdout); process.stderr.write(r.stderr); process.exit(r.status ?? 1);
} else if (cmd === "verify") {
  const tol = opt("tolerance") ? ["--tolerance", opt("tolerance")] : [];
  const r = runParity(["--golden", opt("golden"), "--port", opt("port"), ...tol]);
  process.stdout.write(r.stdout); process.stderr.write(r.stderr); process.exit(r.status ?? 1);
} else if (cmd === "control") {
  const golden = opt("golden"), port = opt("port"), mutant = opt("mutant");
  if (!golden || !port || !mutant) { console.error("usage: rea.mjs control --golden g --port cmd --mutant cmd"); process.exit(2); }
  const tol = opt("tolerance") ? ["--tolerance", opt("tolerance")] : [];
  const p = runParity(["--golden", golden, "--port", port, ...tol]);
  if (p.status !== 0) { console.log(`control: RED — port diverges from the golden\n${p.stdout}${p.stderr}`); process.exit(1); }
  const m = runParity(["--golden", golden, "--port", mutant, ...tol]);
  if (m.status === 0) { console.log("control: RED — mutant survived: the golden cannot tell a wrong implementation from the port. Add fixtures that exercise the mutated path."); process.exit(1); }
  console.log("control: GREEN — port matches the golden and the mutant is caught");
} else {
  console.error("usage: rea.mjs seams|characterize|verify|control (see header)"); process.exit(2);
}
