"""WCAG AA contrast check for a Lovable project's design tokens, light and dark. Exit 1 on any failure.

Usage: python3 scripts/check-contrast.py [--css src/styles.css] [--pairs contrast-pairs.json]

Checks the standard shadcn/Lovable token pairs. Project-specific pairs (brand colors, agent chips)
go in contrast-pairs.json as [["label", "fg-token", "bg-token"], ...]. Pairs whose tokens don't
exist in a theme are reported as SKIP, not FAIL, so the same script works on every project.
Understands #hex, rgb(), hsl(h s% l%), bare "h s% l%" (older shadcn) and oklch(L C H) (Lovable's stock
template, Tailwind v4). Alpha ("/ 50%") is ignored. If the core pairs can't be parsed the script FAILS
(exit 2) instead of silently passing.
"""
import argparse, colorsys, json, re, sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--css", default="src/styles.css")
ap.add_argument("--pairs", default="contrast-pairs.json")
args = ap.parse_args()
css = Path(args.css).read_text()


def block(sel):
    i = css.find(sel + " {")
    if i < 0:
        return {}
    return dict(re.findall(r"--([\w-]+):\s*([^;]+);", css[i:css.index("}", i)]))


def _oklch(L, C, H):
    import math
    a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    lin = (4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
           -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
           -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_)
    enc = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return tuple(min(1.0, max(0.0, enc(min(1.0, max(0.0, x))))) for x in lin)


def rgb(v):
    v = v.strip()
    m = re.match(r"oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)", v)
    if m:
        L = float(m.group(1)) / (100 if m.group(2) else 1)
        return _oklch(L, float(m.group(3)), float(m.group(4)))
    m = re.match(r"rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)", v)
    if m:
        return tuple(float(x) / 255 for x in m.groups())
    if v.startswith("#"):
        h = v[1:]
        if len(h) in (3, 4):
            h = "".join(ch * 2 for ch in h[:3])
        return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    m = re.match(r"(?:hsl\()?\s*([\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%", v)
    if m:
        h, s, l = map(float, m.groups())
        return colorsys.hls_to_rgb(h / 360, l / 100, s / 100)
    raise ValueError(v)


def lum(c):
    f = lambda x: x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4
    r, g, b = map(f, c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def mix(fg, bg, a):
    return tuple(fg[i] * a + bg[i] * (1 - a) for i in range(3))


PAIRS = [
    ("foreground / background", "foreground", "background"),
    ("card-fg / card", "card-foreground", "card"),
    ("muted-fg / background", "muted-foreground", "background"),
    ("muted-fg / muted", "muted-foreground", "muted"),
    ("primary-fg / primary", "primary-foreground", "primary"),
    ("primary / card (links)", "primary", "card"),
    ("primary / accent (active nav)", "primary", "accent"),
    ("destructive-fg / destructive", "destructive-foreground", "destructive"),
    ("success-fg / success", "success-foreground", "success"),
    ("danger-fg / danger", "danger-foreground", "danger"),
    ("danger / card (errors)", "danger", "card"),
]
# contrast-pairs.json is either a list of pairs, or {"themes": ["light"], "pairs": [...]} for an app that
# ships one theme on purpose (GrahmOS Maps, 2026-11-08). Undeclared missing themes still fail (exit 2).
THEMES = ("light", "dark")
extra = Path(args.pairs)
if extra.exists():
    cfg = json.loads(extra.read_text())
    if isinstance(cfg, dict):
        THEMES = tuple(t for t in cfg.get("themes", THEMES) if t in ("light", "dark")) or ("light", "dark")
        cfg = cfg.get("pairs", [])
    PAIRS += [tuple(p) for p in cfg]

fails = 0
checked = {}
for theme, sel in (("light", ":root"), ("dark", ".dark")):
    if theme not in THEMES:
        print(f"{theme:5} (not shipped: contrast-pairs.json declares themes {list(THEMES)})")
        continue
    t = {}
    for k, v in block(sel).items():
        try:
            t[k] = rgb(v)
        except ValueError:
            pass  # radius, fonts, var() references
    if not t:
        print(f"{theme:5} (no {sel} block, skipped)")
        continue
    rows = []
    for name, a, b in PAIRS:
        rows.append((name, ratio(t[a], t[b]) if a in t and b in t else None))
    # Tinted badges: text in the tone color on a 12–15% wash of it over the card.
    for tone, alpha in (("success", .12), ("warning", .15), ("danger", .12)):
        if tone in t and "card" in t:
            rows.append((f"{tone} badge text", ratio(t[tone], mix(t[tone], t["card"], alpha))))
    for name, r in rows:
        if r is None:
            print(f"{theme:5} {name:40}   --  SKIP")
            continue
        ok = r >= 4.5
        fails += not ok
        checked[theme] = checked.get(theme, 0) + 1
        print(f"{theme:5} {name:40} {r:5.2f} {'OK' if ok else 'FAIL'}")
print(f"\n{fails} failing pair(s); checked {checked}")
if any(checked.get(t, 0) < 3 for t in THEMES):
    print("ERROR: fewer than 3 pairs parsed per theme. Unknown color format or missing .dark block: nothing was really checked.")
    sys.exit(2)
sys.exit(1 if fails else 0)
