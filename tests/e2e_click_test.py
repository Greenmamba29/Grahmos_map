"""OSA click-through test harness for GrahmOS Maps.

Usage: python3 tests/e2e_click_test.py [base_url] [screenshot_dir]

Run against `vite preview` (npm run build && npx vite preview): the offline check needs the production
service worker, which dev mode doesn't register.

Standard checks adapted for this app: the phone navigation is the bottom bar labelled "Primary" (no
sidebar), PWA assets are /manifest.webmanifest, /icons/map-icon.svg and /service-worker.js. There is no
dark theme yet, so M5 (dark mode persists) is not run: tracked in the README roadmap.
"""
import re
import sys
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
SHOTS = sys.argv[2] if len(sys.argv) > 2 else "."
ROUTES = ["/"]
TABS = ["Explore", "Directions", "Mesh", "Offline"]
results = []


def check(name, fn):
    try:
        fn()
        results.append((name, "PASS", ""))
    except Exception as e:  # noqa: BLE001
        lines = str(e).splitlines() or [""]
        why = next((ln.strip() for ln in lines[1:] if "Error:" in ln), "")
        results.append((name, "FAIL", (lines[0] + (f" | {why}" if why else ""))[:300]))


def floor(pg, name):
    return pg.get_by_role("navigation", name="Floors").get_by_role("button", name=re.compile(name))


def search_box(pg):
    return pg.get_by_role("searchbox")


def search_and_pick(pg, query, name):
    search_box(pg).fill(query)
    pg.get_by_role("listbox", name="Search results").get_by_role("option", name=re.compile(name)).first.click()


with sync_playwright() as p:
    b = p.chromium.launch()
    errors = []

    def watch(pg):
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: m.type == "error" and "ERR_TUNNEL" not in m.text and errors.append(m.text))

    ctx = b.new_context(viewport={"width": 1280, "height": 860})
    page = ctx.new_page()
    watch(page)
    page.goto(BASE, wait_until="networkidle")

    def t1():
        expect(page.get_by_role("application", name=re.compile("Ground Level floor plan"))).to_be_visible()
        for level in ("Ground Level", "Level 2", "Level 3"):
            expect(floor(page, level)).to_be_visible()
    check("1. Offline floor plan renders with floors 1–3", t1)

    def t2():
        search_and_pick(page, "libary", "Library")
        expect(page.get_by_role("region", name="Library details")).to_be_visible()
    check("2. Search tolerates typos (libary → Library)", t2)

    def t3():
        search_and_pick(page, "main lobby", "Main Lobby")
        page.get_by_role("button", name="I'm here").click()
        page.get_by_role("navigation", name="Primary").get_by_role("button", name="Directions").click()
        page.get_by_role("combobox", name="Destination").select_option(value="L3-emergency-operations-center")
        expect(page.get_by_text(re.compile(r"Take the (stairs|elevator) up to Level 3"))).to_be_visible()
        expect(page.get_by_text("Arrive at your destination")).to_be_visible()
    check("3. Directions cross floors from 'I'm here'", t3)
    page.screenshot(path=f"{SHOTS}/01-directions.png")

    def t4():
        page.get_by_label(re.compile("Step-free route")).check()
        expect(page.get_by_text(re.compile("Take the elevator up to Level 3"))).to_be_visible()
        expect(page.get_by_text(re.compile("Take the stairs"))).to_have_count(0)
    check("4. Step-free routing uses the elevator only", t4)

    def t5():
        other = ctx.new_page()
        watch(other)
        other.goto(BASE, wait_until="networkidle")
        page.bring_to_front()
        page.get_by_role("navigation", name="Primary").get_by_role("button", name="Mesh").click()
        page.get_by_role("button", name="Closure").first.click()
        floor(page, "Ground Level").click()
        box = page.locator("svg.floor-map").bounding_box()
        page.mouse.click(box["x"] + box["width"] * 0.62, box["y"] + box["height"] * 0.5)
        page.get_by_label("Details").fill("Collapsed ceiling")
        page.get_by_role("button", name="Share", exact=True).click()
        other.wait_for_timeout(600)
        other.get_by_role("navigation", name="Primary").get_by_role("button", name="Mesh").click()
        expect(other.get_by_text("Closure: Collapsed ceiling")).to_be_visible()
        expect(other.get_by_text(re.compile("Signed by"))).to_be_visible()
        other.screenshot(path=f"{SHOTS}/02-mesh-peer.png")
        other.close()
    check("5. A closure reported in one tab reaches another, signed", t5)

    def t6():
        page.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller !== null", timeout=15000)
        ctx.set_offline(True)
        try:
            page.reload(wait_until="load")
            search_box(page).fill("restroom")
            expect(page.get_by_role("listbox", name="Search results").get_by_role("option").first).to_be_visible()
        finally:
            ctx.set_offline(False)
    check("6. Reload with no network: the app and search still work", t6)

    # ---------------- STANDARD CHECKS (mobile + PWA) ----------------
    m = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    watch(m)

    def m1():
        for r in ROUTES:
            m.goto(BASE + r, wait_until="load")
            over = m.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            assert over <= 1, f"{r} scrolls sideways by {over}px"
    check("M1. No horizontal scroll at 390px", m1)

    def m2():
        m.goto(BASE, wait_until="load")
        nav = m.get_by_role("navigation", name="Primary")
        for t in TABS:
            expect(nav.get_by_role("button", name=re.compile(rf"\b{t}\b"))).to_be_visible()
    check("M2. Bottom navigation on phones", m2)

    def m3():
        bad = []
        sheets = [None, "Directions", "Mesh", "Offline"]
        for sheet in sheets:
            m.goto(BASE, wait_until="networkidle")
            m.wait_for_timeout(300)
            if sheet:
                m.get_by_role("navigation", name="Primary").get_by_role("button", name=sheet).click()
                m.wait_for_timeout(250)
            small = m.evaluate("""() => [...document.querySelectorAll('button, a[href], input, select, textarea')]
              .filter(e => e.offsetParent && !e.closest('[data-allow-small]') && e.type !== 'file')
              .map(e => [e, (e.type === 'checkbox' || e.type === 'radio') && e.closest('label') ? e.closest('label') : e, getComputedStyle(e)])
              .map(([e, box, s]) => [e, box.getBoundingClientRect(), s])
              .filter(([e, r, s]) => r.height < 43.5 || (['INPUT','SELECT','TEXTAREA'].includes(e.tagName) && !['checkbox','radio','file','range'].includes(e.type) && parseFloat(s.fontSize) < 16))
              .map(([e, r, s]) => `${e.tagName} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(r.height)}px/${s.fontSize}`)""")
            bad += [f"{sheet or 'Explore'}: {x}" for x in small]
        assert not bad, f"{len(bad)} small targets: {bad[:6]}"
    check("M3. 44px tap targets, 16px inputs (map and every sheet)", m3)

    def m4():
        m.goto(BASE, wait_until="load")
        assert "viewport-fit=cover" in (m.locator('meta[name="viewport"]').get_attribute("content") or "")
        expect(m.locator('meta[name="theme-color"]')).to_have_count(1)
        href = m.locator('link[rel="manifest"]').get_attribute("href")
        for path in (href, "/icons/map-icon.svg", "/service-worker.js"):
            assert m.request.get(BASE + path).ok, f"{path} not served"
    check("M4. PWA manifest, icon, service worker served", m4)
    m.screenshot(path=f"{SHOTS}/mobile.png")

    def a1():
        # The gate's a11y engine scans routes; this app is one route whose UI lives in sheets and dialogs,
        # so scan each state too (the route-only scan missed 4 serious/critical violations, 2026-11-08).
        import os
        axe_path = next(p for p in ("node_modules/axe-core/axe.min.js", "osa-kit/node_modules/axe-core/axe.min.js") if os.path.exists(p))
        axe = open(axe_path, encoding="utf-8").read()
        tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]
        found = []
        for vw in ({"width": 390, "height": 844}, {"width": 1440, "height": 1000}):
            pg = b.new_page(viewport=vw)
            pg.goto(BASE, wait_until="networkidle")
            nav = pg.get_by_role("navigation", name="Primary")

            def scan(label):
                pg.wait_for_timeout(450)  # sheets animate in; mid-animation opacity skews contrast
                pg.add_script_tag(content=axe)
                res = pg.evaluate("t => axe.run(document, { runOnly: { type: 'tag', values: t } })", tags)
                found.extend(f"{label}@{vw['width']}: {v['id']} ({v['impact']})" for v in res["violations"])

            search_box(pg).fill("lib"); scan("search results")
            search_box(pg).fill("zzzz"); scan("no results")
            search_and_pick(pg, "lib", "Library"); scan("place sheet")
            pg.get_by_role("button", name="I'm here").click()
            nav.get_by_role("button", name="Directions").click()
            pg.get_by_role("combobox", name="Destination").select_option(value="L3-server-room"); scan("directions")
            nav.get_by_role("button", name="Mesh").click(); scan("mesh")
            pg.get_by_role("button", name="Hazard").first.click()
            box = pg.locator("svg.floor-map").bounding_box()
            pg.mouse.click(box["x"] + box["width"] * 0.6, box["y"] + box["height"] * 0.5); scan("report dialog")
            pg.get_by_role("button", name="Cancel").click()
            nav.get_by_role("button", name="Offline").click(); scan("offline")
            pg.close()
        assert not found, f"{len(found)} axe violation(s): {found[:5]}"
    check("A1. axe WCAG A/AA clean on every sheet and dialog (phone + desktop)", a1)

    check("M6. No console errors", lambda: (_ for _ in ()).throw(AssertionError(errors[:3])) if errors else None)
    b.close()

w = max(len(n) for n, _, _ in results)
for n, s, why in results:
    print(f"{s}  {n:{w}}  {why}")
passed = sum(s == "PASS" for _, s, _ in results)
print(f"\n{passed}/{len(results)} passed")
sys.exit(0 if passed == len(results) else 1)
