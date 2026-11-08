// Exact pins from every committed JS lockfile, for the deps-audit fallback (npm bulk advisory API).
// Cycle 17: the fallback read only the root bun.lock. careerplacego-foundation's student/package-lock.json
// pinned next 16.3.8 (3 advisories); the local gate passed and CI's osv-scanner, which reads every lockfile, failed.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Pins from bun.lock text: { name: Set<version> }. */
export function bunLockPins(text, into = {}) {
  for (const m of text.matchAll(/^    "[^"]+": \["((?:@[^@"\/]+\/)?[^@"]+)@(\d[^"]*)"/gm)) (into[m[1]] ??= new Set()).add(m[2]);
  return into;
}

/** Pins from package-lock.json (v2/v3 "packages" map) text. Workspace links and the root entry are skipped. */
export function npmLockPins(text, into = {}) {
  const lock = JSON.parse(text);
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    if (!path || entry.link || !entry.version) continue;
    const name = entry.name ?? path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
    if (name) (into[name] ??= new Set()).add(entry.version);
  }
  return into;
}

/** Committed lockfiles under root (git-tracked; build output and node_modules never count). */
export function trackedLockfiles(root) {
  let files = [];
  try {
    files = execFileSync("git", ["ls-files", "-z", "--", "*bun.lock", "*package-lock.json"], { cwd: root, encoding: "utf8" })
      .split("\0").filter(Boolean);
  } catch {
    return ["bun.lock", "package-lock.json"].filter((f) => { try { readFileSync(join(root, f)); return true; } catch { return false; } });
  }
  return files.filter((f) => !/(^|\/)(node_modules|\.output|dist|build)\//.test(f));
}

/** Merged pins across all tracked lockfiles, plus which files were read. */
export function allPins(root) {
  const pins = {};
  const files = trackedLockfiles(root);
  for (const f of files) {
    const text = readFileSync(join(root, f), "utf8");
    if (f.endsWith("bun.lock")) bunLockPins(text, pins);
    else npmLockPins(text, pins);
  }
  return { pins, files };
}
