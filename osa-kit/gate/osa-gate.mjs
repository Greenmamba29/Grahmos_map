#!/usr/bin/env node
// OSA gate: one command that runs every check engine on an OSA project and writes one report.
// The Launch Master runs this before every push and on every scheduled sweep.
//
// Usage (from the project root):
//   node osa-kit/gate/osa-gate.mjs                       # all static engines
//   node osa-kit/gate/osa-gate.mjs --e2e http://127.0.0.1:4175
//   node osa-kit/gate/osa-gate.mjs --target https://myapp.lovable.app   # passive DAST (must be in osa.targets.json)
//   node osa-kit/gate/osa-gate.mjs --only typecheck,secrets --json .osa/gate.json
//
// Exit 0 = no FAIL. WARN never blocks. SKIP says why (missing tool, not applicable).
// Node built-ins only, so it runs in any Lovable project without installing anything.
import { spawnSync } from "node:child_process";
import { allPins } from "./lockpins.mjs";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, appendFileSync, mkdtempSync, copyFileSync, rmSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const KIT = dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const only = opt("only")?.split(",");
const skip = opt("skip")?.split(",") ?? [];

const pkg = existsSync("package.json") ? JSON.parse(readFileSync("package.json", "utf8")) : {};
const has = (cmd) => spawnSync("sh", ["-c", `command -v ${cmd}`]).status === 0;
const run = (cmd, argv, o = {}) => {
  const r = spawnSync(cmd, argv, { encoding: "utf8", maxBuffer: 64 << 20, timeout: o.timeout ?? 600_000, cwd: o.cwd ?? ROOT, input: o.input });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}`, stdout: r.stdout ?? "" };
};
const tail = (s, n = 6) => s.trim().split("\n").slice(-n).join("\n");
const res = (status, summary, details = "") => ({ status, summary, details });

// Files tracked by git (falls back to a walk). Everything else (node_modules, dist) is ignored.
function trackedFiles() {
  const g = run("git", ["ls-files", "-co", "--exclude-standard"]);
  const junk = /(^|\/)(node_modules|\.output|dist|build|\.osa|\.git|target|\.venv)(\/|$)/;
  if (g.code === 0) return g.stdout.split("\n").filter(Boolean).filter((f) => !junk.test(f) && existsSync(f) && statSync(f).isFile());
  const out = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (["node_modules", ".git", "dist", ".output"].includes(e.name)) continue; const p = join(d, e.name); e.isDirectory() ? walk(p) : out.push(relative(ROOT, p)); } };
  walk(ROOT);
  return out;
}
const TEXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx", ".json", ".md", ".html", ".css", ".py", ".sh", ".yml", ".yaml", ".toml", ".env", ".txt", ".webmanifest", ""]);

// ---------------------------------------------------------------- engines
const engines = [
  {
    id: "typecheck", area: "correctness", why: "Strict tsc must be 0 errors (Lovable's tsconfig is strict).",
    run() {
      if (!existsSync("tsconfig.json")) return res("skip", "no tsconfig.json");
      // GrahmOS Maps (2026-11-08): Vite's solution-style tsconfig ("files": [] + "references") makes
      // `tsc -p .` check nothing, so an injected type error PASSED. Build mode follows the references.
      const solution = /"references"\s*:\s*\[\s*\{/.test(readFileSync("tsconfig.json", "utf8"));
      const r = solution
        ? run("npx", ["--no-install", "tsc", "-b", "--pretty", "false"])
        : run("npx", ["--no-install", "tsc", "--noEmit", "-p", "."]);
      const n = (r.out.match(/error TS\d+/g) ?? []).length;
      const how = solution ? " (tsc -b: project references)" : "";
      return r.code === 0 ? res("pass", `0 type errors${how}`) : res("fail", `${n || "?"} type error(s)${how}`, tail(r.out, 12));
    },
  },
  {
    id: "lint", area: "correctness", why: "ESLint errors (warnings don't block).",
    run() {
      if (!["eslint.config.js", "eslint.config.mjs", ".eslintrc.json", ".eslintrc.cjs"].some(existsSync)) return res("skip", "no eslint config");
      const r = run("npx", ["--no-install", "eslint", ".", "--ignore-pattern", "osa-kit/**", "--ignore-pattern", ".osa/**", "-f", "json"]);
      // Formatting (prettier/prettier) is reported apart from real errors: Lovable's own stock files aren't
      // prettier-clean, and reformatting stock shadcn would fight Lovable's diffs. Real rule errors fail.
      let errs = 0, fmt = 0, warns = 0, firsts = [];
      try {
        for (const f of JSON.parse(r.stdout)) for (const m of f.messages) {
          if (m.severity !== 2) { warns++; continue; }
          if (m.ruleId === "prettier/prettier") { fmt++; continue; }
          errs++;
          if (firsts.length < 8) firsts.push(`${relative(ROOT, f.filePath)}:${m.line} ${m.ruleId}: ${m.message}`);
        }
      } catch { return res("warn", "eslint output not parseable", tail(r.out)); }
      const s = `${errs} error(s), ${fmt} formatting, ${warns} warning(s)`;
      return errs ? res("fail", s, firsts.join("\n")) : res(fmt || warns ? "warn" : "pass", s, fmt ? "formatting: npx prettier --write <files you changed> (leave stock src/components/ui alone)" : "");
    },
  },
  {
    id: "core-tests", area: "correctness", why: "Pure core tests, including the HIL approval contract.",
    run() {
      const dir = "tests/core";
      if (!existsSync(dir)) return res("skip", "no tests/core");
      const files = readdirSync(dir).filter((f) => f.endsWith(".test.ts")).map((f) => join(dir, f));
      if (!files.length) return res("skip", "no core tests");
      const r = run("node", ["--test", ...files]);
      const pass = r.out.match(/# pass (\d+)/)?.[1], fail = r.out.match(/# fail (\d+)/)?.[1];
      const hil = files.some((f) => f.endsWith("hil.test.ts"));
      const s = `${pass ?? "?"} passed, ${fail ?? "?"} failed${hil ? "" : " (hil.test.ts missing: approval contract unguarded)"}`;
      return r.code !== 0 ? res("fail", s, tail(r.out, 15)) : res(hil ? "pass" : "warn", s);
    },
  },
  {
    // GrahmOS Maps (2026-11-08): the gate went GREEN without running the app's 35 vitest tests, because
    // core-tests only looks at tests/core. Any project with an npm "test" script has it run here.
    id: "app-tests", area: "correctness", why: "The project's own test suite (npm test), whatever runner it uses.",
    run() {
      const script = pkg.scripts?.test;
      if (!script || /no test specified/.test(script)) return res("skip", "no npm test script");
      const r = run("npm", ["test", "--silent"], { timeout: 900_000 });
      const clean = r.out.replace(/\x1b\[[0-9;]*m/g, "");
      const vitest = clean.match(/Tests\s+(?:(\d+) failed \| )?(\d+) passed(?: \((\d+)\))?/);
      const node = clean.match(/# pass (\d+)[\s\S]*?# fail (\d+)/);
      const s = vitest ? `${vitest[2]} passed${vitest[1] ? `, ${vitest[1]} failed` : ""}` : node ? `${node[1]} passed, ${node[2]} failed` : `exit ${r.code}`;
      return r.code === 0 ? res("pass", s) : res("fail", s, tail(clean, 15));
    },
  },
  {
    // Plumb (2026-10-05): a parameter property in src/core/engines/port.ts type-checked fine, but Node's type
    // stripping (node --test, and Metro for Expo) refuses it, and core tests only caught it because a test happened
    // to import that file. Every core file must be strip-only syntax: no enums, namespaces or parameter properties.
    id: "core-strip", area: "correctness", why: "src/core must run under type stripping (node --test, Metro): no enums, namespaces or parameter properties.",
    run() {
      if (!existsSync("src/core")) return res("skip", "no src/core");
      const files = trackedFiles().filter((f) => f.startsWith("src/core/") && f.endsWith(".ts") && !f.endsWith(".d.ts"));
      const code = 'const {stripTypeScriptTypes:s}=require("node:module");if(!s){console.log("SKIP");process.exit(0)}const bad=[];for(const f of process.argv.slice(1)){try{s(require("node:fs").readFileSync(f,"utf8"))}catch(e){bad.push(f+": "+String(e.message).split("\\n")[0])}}console.log(JSON.stringify(bad))';
      const r = run("node", ["--no-warnings", "-e", code, ...files]);
      if (r.stdout.trim() === "SKIP") return res("skip", "this Node has no module.stripTypeScriptTypes (needs 22.13+)");
      let bad = [];
      try { bad = JSON.parse(r.stdout.trim().split("\n").pop() ?? "[]"); } catch { return res("warn", "couldn't read the strip check", tail(r.out)); }
      return bad.length ? res("fail", `${bad.length} core file(s) use syntax type stripping refuses`, bad.slice(0, 6).join("\n")) : res("pass", `${files.length} core files strip cleanly`);
    },
  },
  {
    id: "test-types", area: "correctness", why: "Tests run type-stripped under node --test, so tsc must check them too (with the project's strict options).",
    run() {
      const dirs = ["tests/core", "osa-kit/tests", "osa-kit/core"].filter(existsSync);
      if (!existsSync("tsconfig.json") || !dirs.length) return res("skip", "no tsconfig.json or test dirs");
      if (!existsSync("node_modules/@types/node")) return res("skip", "@types/node not installed");
      const base = readFileSync("tsconfig.json", "utf8");
      const types = [...new Set([...(base.match(/"types"\s*:\s*\[([^\]]*)\]/)?.[1].match(/"[^"]+"/g) ?? []).map((s) => s.slice(1, -1)), "node"])];
      mkdirSync(".osa", { recursive: true });
      const include = ["src/**/*.ts", "src/**/*.tsx", ...dirs.map((d) => `${d}/**/*.ts`)].map((g) => `../${g}`);
      writeFileSync(".osa/tsconfig.tests.json", JSON.stringify({ extends: "../tsconfig.json", compilerOptions: { types }, include }, null, 2));
      const r = run("npx", ["--no-install", "tsc", "--noEmit", "-p", ".osa/tsconfig.tests.json"]);
      const n = (r.out.match(/error TS\d+/g) ?? []).length;
      return r.code === 0 ? res("pass", `0 type errors in ${dirs.join(", ")}`) : res("fail", `${n || "?"} type error(s) in tests`, tail(r.out, 12));
    },
  },
  {
    id: "hil-sync", area: "product", why: "A project's src/core/hil.ts is the kit's engine verbatim; local edits fork the approval contract.",
    run() {
      const kit = join(KIT, "..", "core", "hil.ts");
      if (!existsSync("src/core/hil.ts")) return res("skip", "no src/core/hil.ts (install the kit)");
      if (!existsSync(kit)) return res("skip", "kit hil.ts not found next to the gate");
      return readFileSync(kit, "utf8") === readFileSync("src/core/hil.ts", "utf8")
        ? res("pass", "src/core/hil.ts matches the kit")
        : res("fail", "src/core/hil.ts differs from osa-kit/core/hil.ts", "Improve the engine in osa-kit/core/hil.ts, then copy it over. Domain rules belong in the Engine you pass in.");
    },
  },
  {
    id: "jev-sync", area: "product", why: "A project's src/core/jev.ts is the kit's Jev client verbatim; Guardian's questions and truth tables belong in the product, not in a forked client.",
    run() {
      const kit = join(KIT, "..", "core", "jev.ts");
      if (!existsSync("src/core/jev.ts")) return res("skip", "no src/core/jev.ts (Jev not installed)");
      if (!existsSync(kit)) return res("skip", "kit jev.ts not found next to the gate");
      return readFileSync(kit, "utf8") === readFileSync("src/core/jev.ts", "utf8")
        ? res("pass", "src/core/jev.ts matches the kit")
        : res("fail", "src/core/jev.ts differs from osa-kit/core/jev.ts", "Improve the client in osa-kit/core/jev.ts, then copy it over. Questions and decisions belong in the product's Guardian.");
    },
  },
  {
    id: "tokens", area: "design", why: "Native tokens (src/core/tokens.ts) match src/styles.css.",
    run() {
      if (!existsSync("scripts/sync-tokens.mjs")) return res("skip", "no scripts/sync-tokens.mjs");
      const r = run("node", ["scripts/sync-tokens.mjs", "--check"]);
      return r.code === 0 ? res("pass", "in sync") : res("fail", "stale: run npm run sync:tokens", tail(r.out));
    },
  },
  {
    id: "contrast", area: "accessibility", why: "WCAG AA 4.5:1 on token pairs in both themes.",
    run() {
      const s = existsSync("scripts/check-contrast.py") ? "scripts/check-contrast.py" : join(KIT, "../scripts/check-contrast.py");
      if (!existsSync("src/styles.css")) return res("skip", "no src/styles.css");
      const r = run("python3", [s]);
      const line = r.out.match(/\d+ failing pair\(s\)[^\n]*/)?.[0] ?? "";
      return r.code === 0 ? res("pass", line) : res("fail", line || "contrast check could not run", r.out.split("\n").filter((l) => /FAIL|ERROR/.test(l)).join("\n"));
    },
  },
  {
    id: "placeholders", area: "correctness", why: "No unfilled {{TEMPLATE}} fields ship.",
    run() {
      const hits = [];
      for (const f of trackedFiles()) {
        if (!/^(src|public)\//.test(f) || !TEXT.has(extname(f))) continue;
        readFileSync(f, "utf8").split("\n").forEach((l, i) => { if (/\{\{[A-Z_]+\}\}/.test(l)) hits.push(`${f}:${i + 1}`); });
      }
      return hits.length ? res("fail", `${hits.length} placeholder(s)`, hits.slice(0, 10).join("\n")) : res("pass", "none in src/ or public/");
    },
  },
  {
    id: "secrets", area: "security", why: "Credentials in the repo or client env vars. Engine: gitleaks (MIT); built-in rules as fallback.",
    run() {
      if (has("gitleaks")) {
        const r = run("gitleaks", ["dir", ".", "--report-format", "json", "--report-path", "-", "--no-banner", "--redact"]);
        let f = [];
        try { f = JSON.parse(r.stdout || "[]"); } catch { return res("fail", "gitleaks output not parseable", tail(r.out)); }
        return f.length ? res("fail", `gitleaks: ${f.length} finding(s)`, f.slice(0, 15).map((x) => `${x.File}:${x.StartLine} ${x.RuleID}`).join("\n")) : res("pass", "gitleaks: no secrets");
      }
      const rules = [
        ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
        ["private key", /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
        ["GitHub token", /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}/],
        ["Stripe live key", /\b(sk|rk)_live_[A-Za-z0-9]{20,}/],
        ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
        ["Anthropic/OpenAI key", /\bsk-(ant-)?[A-Za-z0-9_-]{32,}/],
        ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
        ["Twilio auth", /\bSK[0-9a-f]{32}\b/],
        ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
        ["hard-coded secret", /\b(password|passwd|secret|api[_-]?key|client[_-]?secret|auth[_-]?token)\b\s*[:=]\s*["'][^"'\s]{12,}["']/i],
        ["secret in client env", /\b(VITE|EXPO_PUBLIC|NEXT_PUBLIC)_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY)[A-Z0-9_]*/],
      ];
      const hits = [];
      for (const f of trackedFiles()) {
        if (!TEXT.has(extname(f)) || /(^|\/)(bun\.lock|package-lock\.json)$/.test(f) || statSync(f).size > 2e6) continue;
        const allowFile = /\.test\.|osa-gate\.mjs$|security\.md$/i.test(f);
        readFileSync(f, "utf8").split("\n").forEach((l, i) => {
          if (/osa-allow-secret/.test(l)) return;
          for (const [name, re] of rules) if (re.test(l) && !(allowFile && name === "hard-coded secret")) hits.push(`${f}:${i + 1} ${name}`);
        });
      }
      const envs = trackedFiles().filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !/\.example$/.test(f));
      for (const e of envs) hits.push(`${e} committed .env file`);
      const note = " (built-in fallback; install gitleaks for the full rule set)";
      return hits.length ? res("fail", `${hits.length} finding(s)${note}`, hits.slice(0, 15).join("\n")) : res("pass", `no credentials found${note}`);
    },
  },
  {
    id: "sast", area: "security", why: "Semgrep with the kit's bundled rules (runs offline).",
    run() {
      if (!has("semgrep")) return res("skip", "semgrep not installed (pip install semgrep)");
      const rules = join(KIT, "rules");
      process.env.SEMGREP_ENABLE_VERSION_CHECK = "0";
      const ex = ["osa-kit", "node_modules", ".output", "dist", "build", ".osa"].flatMap((d) => ["--exclude", d]);
      const r = run("semgrep", ["scan", "--config", rules, "--metrics=off", "--disable-version-check", "--json", "--quiet", ...ex, "."], { timeout: 900_000 });
      let found, parsed;
      try { parsed = JSON.parse(r.stdout); found = parsed.results; } catch { return res("fail", "semgrep did not return JSON", tail(r.out)); }
      // A broken rule file makes semgrep report 0 findings and exit 0. Never let that pass.
      const cfgErr = (parsed.errors ?? []).filter((e) => /config|yaml|rule/i.test(`${e.type ?? ""} ${e.message ?? ""}`));
      if (cfgErr.length) return res("fail", "rule pack invalid: nothing was checked", cfgErr.map((e) => e.message).join("\n").slice(0, 600));
      const errs = found.filter((x) => x.extra.severity === "ERROR");
      const lines = found.slice(0, 12).map((x) => `${x.extra.severity[0]} ${x.path}:${x.start.line} ${x.check_id.split(".").pop()}`);
      // Files semgrep could only partly parse were only partly checked (OpenMAIC: 2 files). A coverage gap
      // is a WARN with the file list, never a silent PASS.
      const partial = [...new Set((parsed.errors ?? []).filter((e) => /pars|syntax/i.test(`${JSON.stringify(e.type ?? "")} ${e.message ?? ""}`)).map((e) => e.path).filter(Boolean))];
      const gap = partial.length ? `; ${partial.length} file(s) only partly parsed` : "";
      const gapLines = partial.slice(0, 5).map((f) => `partly parsed: ${f}`);
      if (errs.length) return res("fail", `${errs.length} error(s), ${found.length - errs.length} other${gap}`, [...lines, ...gapLines].join("\n"));
      return res(found.length || partial.length ? "warn" : "pass", `${found.length} finding(s), 0 errors${gap}`, [...lines, ...gapLines].join("\n"));
    },
  },
  {
    id: "deps-audit", area: "security", why: "Known vulnerabilities in dependencies. Engine: osv-scanner (Apache-2.0, OSV.dev, reads bun.lock); fallback audits every committed lockfile's pins (dev included) via the npm registry bulk advisory API and, like osv-scanner, fails on any known advisory.",
    run() {
      if (!pkg.dependencies) return res("skip", "no dependencies");
      let osvNote = "";
      if (has("osv-scanner")) {
        const r = run("osv-scanner", ["scan", "source", "-r", ".", "--format", "json"], { timeout: 600_000 });
        // osv-scanner prints "0 vulnerabilities" even when it never reached OSV.dev (proxy, offline). That was a
        // false PASS: treat any query/extraction error as "osv unavailable" and fall back to npm audit.
        const offline = /Error during extraction|request failed|max retries exceeded|querybatch/i.test(r.out.slice(r.stdout.length));
        if (!offline) {
          let vulns = [];
          try { vulns = JSON.parse(r.stdout).results.flatMap((x) => x.packages ?? []).flatMap((p) => (p.vulnerabilities ?? []).map((v) => `${p.package.name}@${p.package.version} ${v.id}`)); }
          catch { return res("warn", "osv-scanner output not parseable (offline?)", tail(r.out)); }
          return vulns.length ? res("fail", `osv-scanner: ${vulns.length} known vulnerabilit${vulns.length === 1 ? "y" : "ies"}`, vulns.slice(0, 15).join("\n")) : res("pass", "osv-scanner: no known vulnerabilities");
        }
        osvNote = " (osv-scanner could not reach OSV.dev)";
      }
      // Lovable uses bun.lock. Audit its exact pins through npm's bulk advisory endpoint (registry access only).
      // A fresh `npm install --package-lock-only` audits the newest matching versions instead, which hid the
      // js-yaml/nanoid/brace-expansion pins that turned every OSA repo's CI red on 2026-10-01.
      // Parity with CI (cycle 18): osv-scanner reads every committed lockfile, dev dependencies included, and fails
      // on any known vulnerability. With bun.lock AND package-lock.json present this used to fall through to
      // `npm audit --omit=dev` (dev pins dropped, moderates only warned): local GREEN, CI RED for five days.
      if (existsSync("bun.lock")) {
        // Every committed lockfile, not only the root bun.lock: CI's osv-scanner reads them all (cycle 17).
        const { pins, files: lockfiles } = allPins(ROOT);
        const body = JSON.stringify(Object.fromEntries(Object.entries(pins).map(([k, v]) => [k, [...v]])));
        const r = run("node", ["-e", `fetch("https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",{method:"POST",headers:{"content-type":"application/json"},body:require("fs").readFileSync(0,"utf8")}).then(r=>r.ok?r.text():Promise.reject(r.status)).then(t=>process.stdout.write(t),e=>{console.error("bulk audit failed: "+e);process.exit(1)})`], { input: body, timeout: 120_000 });
        let adv;
        try { adv = JSON.parse(r.stdout); } catch { return res("warn", `bun.lock not audited${osvNote}: registry advisory endpoint unreachable`, tail(r.out)); }
        const hits = Object.entries(adv).flatMap(([n, list]) => list.map((a) => ({ sev: a.severity, line: `${a.severity} ${n} ${a.vulnerable_versions} ${String(a.url).split("/").pop()} (pinned ${[...pins[n]].join(", ")})` })));
        const c = (s) => hits.filter((h) => h.sev === s).length;
        const s = `${lockfiles.join(" + ")} ${Object.keys(pins).length} pins: critical ${c("critical")}, high ${c("high")}, moderate ${c("moderate")}, low ${c("low")}${osvNote}`;
        const det = hits.map((h) => h.line).sort().slice(0, 15).join("\n");
        return hits.length ? res("fail", s, det) : res("pass", s, det);
      }
      // npm projects: audit the committed package-lock.json.
      let dir = ROOT, cleanup = null;
      if (!existsSync("package-lock.json")) {
        dir = mkdtempSync(join(tmpdir(), "osa-audit-")); cleanup = dir;
        copyFileSync("package.json", join(dir, "package.json"));
        const l = run("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund", "--legacy-peer-deps"], { cwd: dir, timeout: 300_000 });
        if (l.code !== 0) { rmSync(dir, { recursive: true, force: true }); return res("warn", "could not resolve a lockfile for audit", tail(l.out)); }
      }
      const r = run("npm", ["audit", "--json"], { cwd: dir, timeout: 300_000 });
      if (cleanup) rmSync(cleanup, { recursive: true, force: true });
      let v;
      try { v = JSON.parse(r.stdout).metadata.vulnerabilities; } catch { return res("warn", "npm audit unavailable", tail(r.out)); }
      const s = `critical ${v.critical}, high ${v.high}, moderate ${v.moderate}, low ${v.low}${osvNote}`;
      return v.critical || v.high || v.moderate || v.low ? res("fail", s, "run: npm audit") : res("pass", s);
    },
  },
  {
    id: "lockfile", area: "correctness", why: "Lockfile tarballs come from the public registry. Lovable's sandbox can write its private npm cache URL into bun.lock: a mirror you don't control (403 outside Lovable in some environments; Tollgate, 2026-10-01).",
    run() {
      const locks = ["bun.lock", "package-lock.json"].filter((f) => existsSync(f));
      if (!locks.length) return res("skip", "no bun.lock or package-lock.json");
      const bad = [];
      for (const f of locks) {
        const urls = readFileSync(f, "utf8").match(/https?:\/\/[^"\s]+\.tgz/g) ?? [];
        for (const u of urls) if (!u.startsWith("https://registry.npmjs.org/")) bad.push(`${f}: ${u}`);
      }
      if (!bad.length) return res("pass", `${locks.join(", ")}: public registry only`);
      const hosts = [...new Set(bad.map((b) => new URL(b.split(": ")[1]).host))].join(", ");
      return res("fail", `${bad.length} tarball URL(s) outside registry.npmjs.org (${hosts})`,
        `${bad.slice(0, 5).join("\n")}\nFix (bun.lock): replace each URL with "" so bun uses the default registry, check the sha512 against npm, then bun install --frozen-lockfile.`);
    },
  },
  {
    id: "typed-ws", area: "security", why: "Every message kind of a vendored typed-WebSocket protocol has exactly one policy rule, read by the compiler (a text scan missed 6 of 108 kinds on Agent Office, 2026-10-03). A kind without a rule would be refused at runtime; a rule without a kind is stale.",
    run() {
      // osa.typed-ws.json: [{ "entry": "vendor/<n>/protocol.d.ts", "union": "ClientMsg", "policy": "src/core/<n>/policy.ts" }]
      if (!existsSync("osa.typed-ws.json")) return res("skip", "no typed-ws protocols (osa.typed-ws.json)");
      const tool = [join(ROOT, "osa-kit/adapter/typed-ws.mjs"), join(KIT, "../adapter/typed-ws.mjs")].find((f) => existsSync(f));
      if (!tool) return res("fail", "osa.typed-ws.json is present but osa-kit/adapter/typed-ws.mjs is not: re-run the kit installer");
      let cfg;
      try { cfg = JSON.parse(readFileSync("osa.typed-ws.json", "utf8")); } catch (e) { return res("fail", `osa.typed-ws.json is not JSON: ${e.message}`); }
      const out = [], bad = [];
      for (const p of Array.isArray(cfg) ? cfg : [cfg]) {
        const r = run("node", [tool, "drift", ROOT, "--entry", p.entry, "--union", p.union, "--policy", join(ROOT, p.policy), "--json"]);
        if (r.code === 2 || !r.stdout.trim().startsWith("{")) { bad.push(`${p.policy}: could not read (${tail(r.out, 2)})`); continue; }
        const d = JSON.parse(r.stdout);
        out.push(`${p.union} ${d.upstream}/${d.policy}`);
        if (d.added.length) bad.push(`${p.policy}: unclassified ${d.added.join(", ")}`);
        if (d.removed.length) bad.push(`${p.policy}: stale ${d.removed.join(", ")}`);
      }
      return bad.length ? res("fail", `${bad.length} protocol policy problem(s)`, bad.join("\n")) : res("pass", out.join("; "));
    },
  },
  {
    id: "licenses", area: "legal", why: "Copyleft or unknown licenses in shipped dependencies (not legal advice).",
    run() {
      if (!existsSync("node_modules")) return res("skip", "node_modules not installed");
      const seen = new Map(), flagged = [];
      const visit = (name) => {
        if (seen.has(name)) return;
        const p = join("node_modules", name, "package.json");
        if (!existsSync(p)) return;
        const j = JSON.parse(readFileSync(p, "utf8"));
        const lic = typeof j.license === "string" ? j.license : j.license?.type ?? (j.licenses?.map((x) => x.type).join(" OR ") || "UNKNOWN");
        seen.set(name, lic);
        if (/\b(AGPL|GPL|LGPL|SSPL|BUSL|CC-BY-NC)\b/i.test(lic) && !/\bOR\b.*\b(MIT|Apache|BSD|ISC)/i.test(lic) || lic === "UNKNOWN") flagged.push(`${name}: ${lic}`);
        for (const d of Object.keys(j.dependencies ?? {})) visit(d);
      };
      for (const d of Object.keys(pkg.dependencies ?? {})) visit(d);
      return flagged.length ? res("warn", `${flagged.length} of ${seen.size} need review`, flagged.slice(0, 12).join("\n")) : res("pass", `${seen.size} packages, all permissive`);
    },
  },
  {
    // Rosa/Immich (2026-10-03): with a copyleft engine run unmodified on its own host ("separate program"
    // model), the boundary must hold in code: the engine's generated client is imported only by its adapter,
    // and none of the engine's own packages (its SDK) ship in the app. The licenses engine only WARNs on a
    // copyleft dependency; a declared engine boundary FAILs. adapt.mjs writes osa.engines.json when the
    // sourced repo is copyleft. Not legal advice.
    id: "engine-isolation", area: "legal", why: "Copyleft engines stay behind their adapter: no SDK in the app, generated client imported only by the adapter (osa.engines.json).",
    run() {
      if (!existsSync("osa.engines.json")) return res("skip", "no osa.engines.json (no copyleft engine declared)");
      let cfg;
      try { cfg = JSON.parse(readFileSync("osa.engines.json", "utf8")); } catch { return res("fail", "osa.engines.json is not valid JSON"); }
      const list = Array.isArray(cfg.engines) ? cfg.engines : [];
      if (!list.length) return res("fail", "osa.engines.json declares no engines");
      const bad = [];
      const deps = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });
      const forbidden = (spec, e) => (e.forbidPackages ?? []).some((f) => (f.endsWith("/") ? spec.startsWith(f) : spec === f || spec.startsWith(`${f}/`)));
      const files = trackedFiles().filter((f) => /^(src|tests)\//.test(f) && /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f));
      for (const e of list) {
        if (!e.name || !e.client) { bad.push(`engine entry needs "name" and "client": ${JSON.stringify(e)}`); continue; }
        const client = e.client.endsWith("/") ? e.client : `${e.client}/`;
        const allowed = new Set([...(e.adapters ?? []), `tests/core/api-${e.name}.test.ts`]);
        for (const d of deps) if (forbidden(d, e)) bad.push(`package.json: ${d} is ${e.name}'s own package (${e.license ?? "copyleft"}); talk to the engine over HTTP instead`);
        for (const f of files) {
          if (f.startsWith(client) || allowed.has(f)) continue;
          const text = readFileSync(f, "utf8");
          for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["']([^"']+)["']/g)) {
            const spec = m[1] ?? "";
            if (forbidden(spec, e)) { bad.push(`${f}: imports ${spec} (${e.name}'s own package)`); continue; }
            if (!spec.startsWith(".")) continue;
            const target = relative(ROOT, join(ROOT, dirname(f), spec));
            // The generated proxy IS the boundary (allowlist, header stripping, credential injection): server
            // routes mount it and tests attack it. Only the client and schema stay adapter-only. (Cutline cycle,
            // 2026-10-05: a test proving the Postiz proxy drops x-postiz-org was flagged as a violation.)
            const proxyFile = target.replace(/\.ts$/, "") === `${client}proxy`;
            if (proxyFile && /^(tests\/|src\/server\/|src\/routes\/api\/)/.test(f)) continue;
            if (`${target}/`.startsWith(client) || target.startsWith(client)) bad.push(`${f}: imports ${e.name}'s generated client (${spec}); only ${[...(e.adapters ?? [])].join(", ") || "its adapter"} may`);
          }
        }
      }
      const names = list.map((e) => `${e.name}${e.license ? ` (${e.license})` : ""}`).join(", ");
      return bad.length ? res("fail", `${bad.length} boundary violation(s): ${names}`, bad.slice(0, 12).join("\n")) : res("pass", `${names}: client only in its adapter, no engine packages shipped`);
    },
  },
  {
    id: "hil-contract", area: "product", why: "High-risk kinds are declared and the approval gate can't be bypassed from UI code.",
    run() {
      const core = existsSync("src/core") ? trackedFiles().filter((f) => f.startsWith("src/")) : [];
      if (!core.length) return res("skip", "no src/");
      const bad = [];
      const hasEngine = core.includes("src/core/hil.ts");
      for (const f of core) {
        const t = readFileSync(f, "utf8");
        if (/status:\s*["']auto_approved["']/.test(t) && !/src\/core\//.test(f)) bad.push(`${f}: sets auto_approved outside src/core`);
        if (/risk\s*===?\s*["']high["'][^\n]*autoApprove\s*\[/.test(t)) bad.push(`${f}: high risk consulted in auto-approve policy`);
        // With the kit engine installed, decisions are made only inside it. An app reducer that sets these
        // statuses itself skips the contract (Conductor's did: deny without a reason, deny after approve).
        if (hasEngine && f !== "src/core/hil.ts" && /status:\s*["'](approved|denied|changes_requested)["']/.test(t)) bad.push(`${f}: decides a request outside src/core/hil.ts`);
        if (/requireNoteOnHigh/.test(t)) bad.push(`${f}: high-risk note made optional (the contract always requires it)`);
      }
      return bad.length ? res("fail", `${bad.length} bypass risk(s)`, bad.join("\n")) : res("pass", "approvals only decided in core");
    },
  },
  {
    id: "ci-lint", area: "correctness", why: "GitHub Actions workflows checked by actionlint (MIT) before they fail on GitHub.",
    run() {
      if (!existsSync(".github/workflows")) return res("skip", "no .github/workflows");
      if (!has("actionlint")) return res("skip", "actionlint not installed (pip install actionlint-py)");
      const wf = readdirSync(".github/workflows").filter((f) => /\.ya?ml$/.test(f)).map((f) => join(".github/workflows", f));
      if (!wf.length) return res("skip", "no workflow files");
      const r = run("actionlint", ["-no-color", ...wf]); // explicit paths: works outside a git checkout
      const n = r.out.split("\n").filter((l) => /:\d+:\d+:/.test(l)).length;
      if (r.code !== 0) return res("fail", `${n} workflow problem(s)`, tail(r.out, 12));
      // actionlint checks run: scripts only through shellcheck on PATH. CI has it; without it a PASS here hid four
      // problems CI found (cycle 18). Report the gap instead of a clean pass.
      return has("shellcheck") ? res("pass", "workflows valid") : res("warn", "workflows valid, but run: scripts unchecked: shellcheck not installed (pip install shellcheck-py)");
    },
  },
  {
    id: "e2e", area: "product", why: "Click-through test script + standard mobile checks M1–M6.",
    run() {
      const url = opt("e2e");
      if (!url) return res("skip", "pass --e2e <dev-server-url>");
      if (!existsSync("tests/e2e_click_test.py")) return res("skip", "no tests/e2e_click_test.py");
      const r = run("python3", ["tests/e2e_click_test.py", url, opt("shots") ?? tmpdir()], { timeout: 900_000 });
      const line = r.out.match(/(\d+)\/(\d+) passed/);
      // Trust the count as well as the exit code: Conductor's harness printed "23/24 passed" and exited 0,
      // so a failing click test still showed PASS (2026-10-05).
      const short = line ? Number(line[1]) < Number(line[2]) : false;
      return r.code === 0 && !short ? res("pass", line?.[0] ?? "passed") : res("fail", line?.[0] ?? "harness error", r.out.split("\n").filter((l) => /^FAIL|Error/.test(l)).slice(0, 10).join("\n"));
    },
  },
  {
    id: "a11y", area: "accessibility", why: "axe-core (MPL-2.0, unmodified) on every route at phone and desktop width. WCAG A/AA violations fail.",
    run() {
      const url = opt("e2e");
      if (!url) return res("skip", "pass --e2e <dev-server-url>");
      const axe = [process.env.AXE_JS, "node_modules/axe-core/axe.min.js", join(KIT, "../node_modules/axe-core/axe.min.js")].find((p) => p && existsSync(p));
      if (!axe) return res("skip", "axe-core not found: npm i -D axe-core (or set AXE_JS)");
      const routes = existsSync("src/routes") ? readdirSync("src/routes").filter((f) => /\.tsx$/.test(f) && !f.startsWith("__")).map((f) => (f === "index.tsx" ? "/" : `/${f.replace(/\.tsx$/, "").replace(/\./g, "/")}`)).filter((r) => !r.includes("$")) : ["/"];
      const r = run("python3", [join(KIT, "a11y.py"), url, axe, ...routes], { timeout: 900_000 });
      const m = r.out.match(/A11Y (\d+) violation\(s\), (\d+) node\(s\) on (\d+) page\(s\)/);
      if (!m) return res("warn", "a11y runner failed", tail(r.out));
      return Number(m[1]) ? res("fail", m[0].slice(5), r.out.split("\n").filter((l) => l.startsWith("  ")).slice(0, 12).join("\n")) : res("pass", m[0].slice(5));
    },
  },
  {
    id: "dast-active", area: "security", why: "Active scan with nuclei (MIT) templates. Owned targets only, and only with --active (a human approves it: it sends attack-shaped traffic).",
    run() {
      const target = opt("target");
      if (!target || !args.includes("--active")) return res("skip", "needs --target <owned url> --active (HIL-approved)");
      const allow = existsSync("osa.targets.json") ? JSON.parse(readFileSync("osa.targets.json", "utf8")).owned ?? [] : [];
      if (!allow.includes(new URL(target).origin)) return res("fail", "target not in osa.targets.json owned list");
      if (!has("nuclei")) return res("skip", "nuclei not installed (runs in CI: osa-kit/ci/osa-gate.yml)");
      const r = run("nuclei", ["-u", target, "-severity", "medium,high,critical", "-jsonl", "-silent", "-rate-limit", "10", "-disable-update-check"], { timeout: 1_800_000 });
      const hits = r.stdout.split("\n").filter(Boolean).map((l) => { try { const j = JSON.parse(l); return `${j.info?.severity} ${j["template-id"]} ${j["matched-at"]}`; } catch { return null; } }).filter(Boolean);
      const high = hits.filter((h) => /^(high|critical)/.test(h));
      return high.length ? res("fail", `${high.length} high/critical`, hits.slice(0, 15).join("\n")) : res(hits.length ? "warn" : "pass", `${hits.length} medium finding(s)`, hits.slice(0, 15).join("\n"));
    },
  },
  {
    id: "dast", area: "security", why: "Passive, read-only checks against a deployed app you own (GET only, rate-limited).",
    async run() {
      const target = opt("target");
      if (!target) return res("skip", "pass --target <url> (listed in osa.targets.json)");
      const allow = existsSync("osa.targets.json") ? JSON.parse(readFileSync("osa.targets.json", "utf8")).owned ?? [] : [];
      const origin = new URL(target).origin;
      if (!allow.includes(origin)) return res("fail", `${origin} is not in osa.targets.json "owned": scanning is limited to targets you own`);
      const find = [], sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const get = async (path) => { await sleep(250); try { return await fetch(origin + path, { redirect: "manual" }); } catch (e) { return { status: 0, headers: new Headers(), text: async () => String(e) }; } };
      const home = await get("/");
      if (!home.status) return res("warn", `could not reach ${origin}`, await home.text());
      const h = home.headers;
      const need = [["content-security-policy", "CSP"], ["x-content-type-options", "nosniff"], ["referrer-policy", "Referrer-Policy"]];
      for (const [k, n] of need) if (!h.get(k)) find.push(`W missing ${n} header`);
      if (!h.get("x-frame-options") && !/frame-ancestors/.test(h.get("content-security-policy") ?? "")) find.push("W no clickjacking protection (X-Frame-Options / frame-ancestors)");
      if (origin.startsWith("https:") && !h.get("strict-transport-security")) find.push("W missing HSTS");
      if (h.get("access-control-allow-origin") === "*" && h.get("access-control-allow-credentials") === "true") find.push("E CORS * with credentials");
      for (const c of (h.get("set-cookie") ?? "").split(/,(?=[^;]+=)/).filter(Boolean)) if (!/;\s*secure/i.test(c) || !/httponly/i.test(c)) find.push(`W cookie without Secure/HttpOnly: ${c.split("=")[0]}`);
      for (const p of ["/.env", "/.git/config", "/.git/HEAD", "/server.ts", "/package.json", "/.DS_Store", "/wp-admin/"]) {
        const r = await get(p);
        const body = r.status === 200 ? (await r.text()).slice(0, 200) : "";
        if (r.status === 200 && !/<!doctype html/i.test(body)) find.push(`E exposed ${p}`);
      }
      const html = await (await get("/")).text();
      const js = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]).slice(0, 3);
      for (const s of js) { const r = await get(`${new URL(s, origin).pathname}.map`); if (r.status === 200) find.push(`W source map public: ${s}.map`); }
      const errs = find.filter((f) => f.startsWith("E"));
      return res(errs.length ? "fail" : find.length ? "warn" : "pass", `${errs.length} error(s), ${find.length - errs.length} warning(s) on ${origin}`, find.join("\n"));
    },
  },
];

// ---------------------------------------------------------------- run
const results = [];
const started = Date.now();
for (const e of engines) {
  if ((only && !only.includes(e.id)) || skip.includes(e.id)) continue;
  const t = Date.now();
  process.stderr.write(`· ${e.id}…\n`);
  let r;
  try { r = await e.run(); } catch (err) { r = res("fail", "engine crashed", String(err?.stack ?? err)); }
  results.push({ id: e.id, area: e.area, ...r, ms: Date.now() - t });
}
const icon = { pass: "PASS", fail: "FAIL", warn: "WARN", skip: "SKIP" };
const w = Math.max(...results.map((r) => r.id.length));
console.log(`\nOSA gate — ${pkg.name ?? ROOT} — ${new Date().toISOString()}`);
for (const r of results) {
  console.log(`${icon[r.status]}  ${r.id.padEnd(w)}  ${r.summary}`);
  if (r.details && r.status !== "pass" && r.status !== "skip") console.log(r.details.split("\n").map((l) => `        ${l}`).join("\n"));
}
const count = (s) => results.filter((r) => r.status === s).length;
const verdict = count("fail") ? "RED" : "GREEN";
console.log(`\n${verdict}: ${count("pass")} pass, ${count("warn")} warn, ${count("fail")} fail, ${count("skip")} skip (${((Date.now() - started) / 1000).toFixed(1)}s)`);

const report = { at: new Date().toISOString(), project: pkg.name, commit: run("git", ["rev-parse", "--short", "HEAD"]).stdout.trim(), verdict, results };
const out = opt("json");
if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2)); }
// History powers the Master's trend view ("are we getting better?"). One line per run.
mkdirSync(".osa", { recursive: true });
appendFileSync(".osa/gate-history.jsonl", JSON.stringify({ at: report.at, commit: report.commit, verdict, ...Object.fromEntries(results.map((r) => [r.id, r.status])) }) + "\n");
process.exit(verdict === "RED" ? 1 : 0);
