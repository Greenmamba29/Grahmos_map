"""axe-core accessibility scan across routes, at phone (390px) and desktop (1440px) width.
Usage: python3 a11y.py <base_url> <path/to/axe.min.js> [route ...]
axe-core (Deque, MPL-2.0) is injected unmodified. Only WCAG 2.x A/AA rules run; each
violation is reported once with the pages it appears on. Last line is machine-read by osa-gate.
"""
import json
import sys
from playwright.sync_api import sync_playwright

base, axe_path, *routes = sys.argv[1:]
routes = routes or ["/"]
axe = open(axe_path, encoding="utf-8").read()
TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]
found = {}
pages = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for vw in ({"width": 390, "height": 844}, {"width": 1440, "height": 1000}):
        pg = b.new_page(viewport=vw)
        for r in routes:
            try:
                pg.goto(base.rstrip("/") + r, wait_until="networkidle", timeout=30000)
            except Exception:  # noqa: BLE001
                pg.goto(base.rstrip("/") + r, wait_until="load")
            pg.wait_for_timeout(400)  # async hydration
            pg.add_script_tag(content=axe)
            res = pg.evaluate("tags => axe.run(document, { runOnly: { type: 'tag', values: tags } })", TAGS)
            pages += 1
            for v in res["violations"]:
                e = found.setdefault(v["id"], {"impact": v["impact"], "help": v["help"], "nodes": 0, "where": set(), "sample": v["nodes"][0]["target"]})
                e["nodes"] += len(v["nodes"])
                e["where"].add(f"{r}@{vw['width']}")
        pg.close()
    b.close()

order = {"critical": 0, "serious": 1, "moderate": 2, "minor": 3}
for vid, e in sorted(found.items(), key=lambda kv: order.get(kv[1]["impact"], 9)):
    print(f"  {e['impact']:8} {vid}: {e['help']} ({e['nodes']} nodes; e.g. {json.dumps(e['sample'])}; {', '.join(sorted(e['where']))[:120]})")
print(f"A11Y {len(found)} violation(s), {sum(e['nodes'] for e in found.values())} node(s) on {pages} page(s)")
