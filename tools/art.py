#!/usr/bin/env python3
"""Art for the Cosmos Herdr layout ("HERDR // DEEP SPACE NETWORK"), all drawn in code.
  mods/cosmos-agents/fleet/<ship>.svg, <ship>-fx.svg   ten original spacecraft + thruster flames
  mods/cosmos-agents/fleet/beacon.svg, stars.svg       the mayday beacon, the frame's starfield
  mods/cosmos-spaces/planets/p<N>.svg                  procedural planets for spaces
  mods/cosmos-chrome/sky.svg, twinkle-a/b.svg, giant.svg, comet.svg   the live header
  mods/cosmos-chrome/nebula-sidebar.png, nebula-stage.png             backdrops (needs Pillow)
Usage: python3 art.py <out dir>"""
import math, os, random, sys

OUT = sys.argv[1]


def wrap(body, defs="", vb="0 0 120 160", w=120, h=160, par=""):
    p = f' preserveAspectRatio="{par}"' if par else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}"{p}><defs>{defs}</defs>{body}</svg>\n'


def lin(id, stops, x1=0, y1=0, x2=0, y2=1):
    s = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return f'<linearGradient id="{id}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{s}</linearGradient>'


def rad(id, stops, cx=0.5, cy=0.5, r=0.5, fx=None, fy=None):
    s = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    f = f' fx="{fx}" fy="{fy}"' if fx is not None else ""
    return f'<radialGradient id="{id}" cx="{cx}" cy="{cy}" r="{r}"{f}>{s}</radialGradient>'


METAL = lin("metal", [(0, "#e9edf7", 1), (0.55, "#9aa3bd", 1), (1, "#4c5470", 1)], 0, 0, 1, 1)
GLASS = lin("glass", [(0, "#c8f4ff", 1), (0.5, "#4fb8e8", 1), (1, "#16346a", 1)], 0.2, 0, 0.8, 1)
DARK = lin("dark", [(0, "#5a6280", 1), (1, "#232842", 1)])
FLAME = lin("flame", [(0, "#fff7d6", 1), (0.3, "#ffd479", 1), (0.7, "#ff7a3c", 0.8), (1, "#ff3c6a", 0)])
BLUEFLAME = lin("bflame", [(0, "#f0fdff", 1), (0.35, "#7ee0ff", 1), (1, "#6f6bff", 0)])
DEFS = METAL + GLASS + DARK


def flame(x, y, w, h, blue=False):
    g = "bflame" if blue else "flame"
    return (f'<path d="M{x - w / 2},{y} Q{x},{y + h * 1.15} {x + w / 2},{y} Z" fill="url(#{g})"/>'
            f'<path d="M{x - w / 4},{y} Q{x},{y + h * 0.6} {x + w / 4},{y} Z" fill="#ffffff" opacity="0.85"/>')


# ── the fleet: (body svg, flames svg, accent) ─────────────────────────────────
def lumen():   # a solar-wing probe
    panel = lambda x: (f'<rect x="{x}" y="50" width="34" height="20" rx="1.5" fill="#1d3f8a" stroke="#c8d2ec" stroke-width="1.2"/>'
                       + "".join(f'<path d="M{x + i * 6.8},50 L{x + i * 6.8},70" stroke="#7aa8ff" stroke-width="0.8" opacity="0.7"/>' for i in range(1, 5))
                       + f'<path d="M{x},60 L{x + 34},60" stroke="#7aa8ff" stroke-width="0.8" opacity="0.7"/>')
    b = (panel(6) + panel(80) + '<rect x="40" y="58" width="40" height="4" fill="url(#metal)"/>'
         '<circle cx="60" cy="60" r="16" fill="url(#metal)" stroke="#2c3350" stroke-width="1.2"/>'
         '<circle cx="60" cy="60" r="8" fill="url(#glass)"/><circle cx="57" cy="57" r="2.4" fill="#fff" opacity="0.8"/>'
         '<path d="M60,44 L60,26" stroke="#c8d2ec" stroke-width="1.6"/><path d="M50,30 Q60,18 70,30 Z" fill="url(#metal)" stroke="#2c3350"/>'
         '<rect x="54" y="74" width="12" height="8" rx="2" fill="url(#dark)"/>')
    return b, flame(60, 82, 10, 26, blue=True), "#7aa8ff"


def atlas():   # a cargo hauler: three containers and twin engines
    cont = lambda y, c: f'<rect x="44" y="{y}" width="32" height="18" rx="2" fill="{c}" stroke="#1b1f33" stroke-width="1.2"/><path d="M50,{y + 3} L50,{y + 15} M56,{y + 3} L56,{y + 15} M64,{y + 3} L64,{y + 15} M70,{y + 3} L70,{y + 15}" stroke="#1b1f33" stroke-width="0.9" opacity="0.5"/>'
    b = ('<path d="M50,30 Q60,10 70,30 Z" fill="url(#metal)" stroke="#2c3350" stroke-width="1.2"/><path d="M54,26 Q60,16 66,26 Z" fill="url(#glass)"/>'
         '<rect x="48" y="30" width="24" height="6" fill="url(#dark)"/>'
         + cont(36, "#e0a046") + cont(56, "#4fa3d8") + cont(76, "#d65a7a")
         + '<rect x="40" y="96" width="40" height="8" rx="2" fill="url(#metal)"/>'
           '<rect x="42" y="104" width="12" height="9" rx="2" fill="url(#dark)"/><rect x="66" y="104" width="12" height="9" rx="2" fill="url(#dark)"/>'
           '<path d="M44,60 L30,74 L44,74 Z M76,60 L90,74 L76,74 Z" fill="url(#metal)" stroke="#2c3350"/>')
    return b, flame(48, 113, 10, 26) + flame(72, 113, 10, 26), "#e0a046"


def nova():    # a saucer with a glass dome and rim lights
    lights = "".join(f'<circle cx="{60 + 40 * math.cos(math.radians(a))}" cy="{70 + 9 * math.sin(math.radians(a))}" r="2.2" fill="{c}"/>'
                     for a, c in ((200, "#7ee0ff"), (240, "#ffd479"), (270, "#ff7ac8"), (300, "#7ef0b0"), (340, "#7ee0ff"), (20, "#ffd479"), (160, "#ff7ac8")))
    b = ('<ellipse cx="60" cy="72" rx="46" ry="14" fill="url(#metal)" stroke="#2c3350" stroke-width="1.4"/>'
         '<ellipse cx="60" cy="68" rx="46" ry="10" fill="#c3cbe2"/><ellipse cx="60" cy="80" rx="22" ry="5" fill="url(#dark)"/>'
         '<path d="M38,66 Q38,40 60,40 Q82,40 82,66 Z" fill="url(#glass)" stroke="#bfe9ff" stroke-width="1.2"/>'
         '<path d="M46,58 Q48,46 60,44" fill="none" stroke="#fff" stroke-width="2" opacity="0.7" stroke-linecap="round"/>' + lights)
    beam = '<path d="M46,84 L74,84 L90,140 L30,140 Z" fill="#7ee0ff" opacity="0.28"/>' + flame(60, 84, 16, 16, blue=True)
    return b, beam, "#7ee0ff"


def halo():    # a ring station: hub, spokes, a habitat ring
    b = ('<circle cx="60" cy="66" r="40" fill="none" stroke="url(#metal)" stroke-width="9"/>'
         '<circle cx="60" cy="66" r="40" fill="none" stroke="#2c3350" stroke-width="1" opacity="0.6"/>'
         + "".join(f'<rect x="{60 + 40 * math.cos(math.radians(a)) - 3}" y="{66 + 40 * math.sin(math.radians(a)) - 2}" width="6" height="4" fill="#ffd479" transform="rotate({a + 90} {60 + 40 * math.cos(math.radians(a))} {66 + 40 * math.sin(math.radians(a))})"/>' for a in range(0, 360, 30))
         + '<path d="M60,26 L60,106 M20,66 L100,66" stroke="#9aa3bd" stroke-width="3"/>'
           '<circle cx="60" cy="66" r="13" fill="url(#metal)" stroke="#2c3350" stroke-width="1.2"/><circle cx="60" cy="66" r="6" fill="url(#glass)"/>'
           '<rect x="56" y="104" width="8" height="8" rx="1.5" fill="url(#dark)"/>')
    lights = "".join(f'<circle cx="{60 + 40 * math.cos(math.radians(a))}" cy="{66 + 40 * math.sin(math.radians(a))}" r="3" fill="#7ee0ff"/>' for a in range(15, 360, 30))
    return b, lights + flame(60, 112, 8, 18, blue=True), "#ffd479"


def drift():   # an escape pod with a porthole
    b = ('<path d="M40,52 Q40,26 60,26 Q80,26 80,52 L80,84 Q80,96 60,96 Q40,96 40,84 Z" fill="url(#metal)" stroke="#2c3350" stroke-width="1.4"/>'
         '<circle cx="60" cy="56" r="12" fill="#2c3350"/><circle cx="60" cy="56" r="9.5" fill="url(#glass)"/><circle cx="56.5" cy="52.5" r="2.4" fill="#fff" opacity="0.8"/>'
         '<path d="M40,74 L80,74" stroke="#ff7a3c" stroke-width="4"/><path d="M40,80 L80,80" stroke="#2c3350" stroke-width="1" opacity="0.5"/>'
         '<rect x="32" y="62" width="8" height="14" rx="2" fill="url(#dark)"/><rect x="80" y="62" width="8" height="14" rx="2" fill="url(#dark)"/>'
         '<rect x="50" y="96" width="20" height="6" rx="2" fill="url(#dark)"/>')
    return b, flame(54, 102, 8, 18) + flame(66, 102, 8, 18), "#ff7a3c"


def quasar():  # an interceptor: swept wings, one big engine
    b = ('<path d="M60,14 L70,56 L104,92 L104,100 L70,90 L66,104 L54,104 L50,90 L16,100 L16,92 L50,56 Z" fill="url(#metal)" stroke="#2c3350" stroke-width="1.4" stroke-linejoin="round"/>'
         '<path d="M60,24 L66,52 L54,52 Z" fill="url(#glass)"/>'
         '<path d="M50,56 L16,92 M70,56 L104,92" stroke="#c56bff" stroke-width="2.5"/>'
         '<path d="M30,90 L36,84 M90,90 L84,84" stroke="#ff5d7a" stroke-width="3" stroke-linecap="round"/>'
         '<rect x="54" y="100" width="12" height="9" rx="2" fill="url(#dark)"/>')
    return b, flame(60, 109, 14, 34, blue=True), "#c56bff"


def pioneer():  # a lander on four legs, gold foil body
    b = ('<path d="M44,74 L28,104 M76,74 L92,104 M50,80 L44,108 M70,80 L76,108" stroke="#9aa3bd" stroke-width="2.6"/>'
         '<path d="M22,104 L34,104 M86,104 L98,104 M38,108 L50,108 M70,108 L82,108" stroke="#c8d2ec" stroke-width="3" stroke-linecap="round"/>'
         '<path d="M40,52 L80,52 L86,78 L34,78 Z" fill="#d9a63c" stroke="#7a5414" stroke-width="1.2"/>'
         '<path d="M40,60 L80,60 M38,68 L82,68" stroke="#f4d27a" stroke-width="1" opacity="0.8"/>'
         '<path d="M46,52 L48,30 L72,30 L74,52 Z" fill="url(#metal)" stroke="#2c3350" stroke-width="1.2"/>'
         '<path d="M52,36 L68,36 L66,46 L54,46 Z" fill="url(#glass)"/><path d="M60,30 L60,18" stroke="#c8d2ec" stroke-width="1.4"/><circle cx="60" cy="17" r="2" fill="#ff5d7a"/>'
         '<path d="M54,78 L66,78 L64,86 L56,86 Z" fill="url(#dark)"/>')
    return b, flame(60, 86, 10, 28), "#d9a63c"


def orbiter():  # a winged space plane
    b = ('<path d="M60,12 Q68,24 68,44 L68,92 L94,108 L94,114 L68,108 L66,116 L54,116 L52,108 L26,114 L26,108 L52,92 L52,44 Q52,24 60,12 Z" fill="#eef1f8" stroke="#2c3350" stroke-width="1.4" stroke-linejoin="round"/>'
         '<path d="M60,12 Q66,20 67,32 L53,32 Q54,20 60,12 Z" fill="#2c3350"/>'
         '<path d="M55,34 L65,34 L64,42 L56,42 Z" fill="url(#glass)"/>'
         '<path d="M52,92 L26,108 L26,114 L52,106 Z M68,92 L94,108 L94,114 L68,106 Z" fill="#2c3350" opacity="0.85"/>'
         '<path d="M60,50 L60,84" stroke="#9aa3bd" stroke-width="1"/><path d="M57,58 L63,58 M57,66 L63,66" stroke="#7ee0ff" stroke-width="1.6"/>'
         '<rect x="53" y="114" width="6" height="8" rx="1.5" fill="url(#dark)"/><rect x="61" y="114" width="6" height="8" rx="1.5" fill="url(#dark)"/>')
    return b, flame(56, 122, 7, 22) + flame(64, 122, 7, 22), "#7ee0ff"


def comet():   # a teardrop racer with fins
    b = ('<path d="M60,14 Q82,48 78,82 Q74,100 60,100 Q46,100 42,82 Q38,48 60,14 Z" fill="url(#metal)" stroke="#2c3350" stroke-width="1.4"/>'
         '<path d="M60,24 Q70,42 68,56 L52,56 Q50,42 60,24 Z" fill="url(#glass)"/>'
         '<path d="M42,76 L26,100 L44,94 Z M78,76 L94,100 L76,94 Z" fill="#ff5d7a" stroke="#2c3350" stroke-width="1.2"/>'
         '<path d="M60,62 L60,90" stroke="#ff5d7a" stroke-width="3"/><path d="M48,66 L72,66" stroke="#ffd479" stroke-width="2"/>'
         '<rect x="53" y="98" width="14" height="7" rx="2" fill="url(#dark)"/>')
    return b, flame(60, 105, 14, 42), "#ff5d7a"


def zephyr():  # a manta-wing glider with glowing edges
    b = ('<path d="M60,30 Q76,34 92,62 Q104,82 110,96 Q84,88 72,92 L66,108 L54,108 L48,92 Q36,88 10,96 Q16,82 28,62 Q44,34 60,30 Z" fill="url(#dark)" stroke="#7ef0b0" stroke-width="1.6" stroke-linejoin="round"/>'
         '<path d="M60,36 Q70,40 72,56 L48,56 Q50,40 60,36 Z" fill="url(#glass)"/>'
         '<path d="M28,62 Q44,70 54,92 M92,62 Q76,70 66,92" fill="none" stroke="#7ef0b0" stroke-width="1" opacity="0.6"/>'
         '<circle cx="34" cy="80" r="2.4" fill="#7ef0b0"/><circle cx="86" cy="80" r="2.4" fill="#7ef0b0"/>'
         '<rect x="54" y="104" width="12" height="7" rx="2" fill="#1b1f33"/>')
    return b, flame(60, 111, 12, 26, blue=True) + '<path d="M10,96 Q36,88 48,92 M110,96 Q84,88 72,92" fill="none" stroke="#7ef0b0" stroke-width="3" opacity="0.8"/>', "#7ef0b0"


FLEET = dict(lumen=lumen, atlas=atlas, nova=nova, halo=halo, drift=drift, quasar=quasar,
             pioneer=pioneer, orbiter=orbiter, comet=comet, zephyr=zephyr)


def stars_svg(seed, n, w=120, h=160, rmax=1.1, colors=("#ffffff", "#cfe8ff", "#ffe9c4")):
    rnd = random.Random(seed)
    return "".join(f'<circle cx="{rnd.uniform(0, w):.1f}" cy="{rnd.uniform(0, h):.1f}" r="{rnd.uniform(0.3, rmax):.2f}" fill="{rnd.choice(colors)}" opacity="{rnd.uniform(0.35, 1):.2f}"/>' for _ in range(n))


# ── planets ───────────────────────────────────────────────────────────────────
PALETTES = [("#f2b16a", "#c9783a", "#ffe1b0"), ("#7ec8ff", "#3a6fd8", "#d9f1ff"), ("#c38cff", "#6b3fc4", "#efdcff"),
            ("#7ef0b0", "#2f9a74", "#d9ffe9"), ("#ff8fa3", "#c4456a", "#ffd9e1"), ("#e8d2a6", "#9c8456", "#fff4dc"),
            ("#ffd479", "#d08a2c", "#fff1c8"), ("#9ad8d0", "#3c7f86", "#e0fffa"), ("#b8c0d8", "#5c6680", "#eef1fa")]


def planet(i):
    rnd = random.Random(1000 + i)
    base, deep, light = PALETTES[i % len(PALETTES)]
    kind = ("gas", "rocky", "ice", "ringed")[i % 4]
    d = (rad("ball", [(0, light, 1), (0.45, base, 1), (1, deep, 1)], 0.38, 0.35, 0.7)
         + rad("atmo", [(0.7, base, 0), (0.86, light, 0.55), (1, light, 0)])
         + rad("shade", [(0.55, "#000", 0), (1, "#000", 0.55)], 0.32, 0.3, 0.75)
         + '<clipPath id="disc"><circle cx="40" cy="40" r="22"/></clipPath>')
    b = ['<circle cx="40" cy="40" r="29" fill="url(#atmo)"/>']
    ring = kind == "ringed" or rnd.random() < 0.25
    tilt = rnd.uniform(-24, 24)
    if ring:   # the back half of the ring
        b.append(f'<ellipse cx="40" cy="40" rx="35" ry="9" fill="none" stroke="{light}" stroke-width="3" opacity="0.55" transform="rotate({tilt:.1f} 40 40)"/>')
    b.append('<circle cx="40" cy="40" r="22" fill="url(#ball)"/>')
    g = ['<g clip-path="url(#disc)">']
    if kind in ("gas", "ringed"):
        y = 18
        while y < 62:
            hgt = rnd.uniform(2, 6)
            g.append(f'<rect x="10" y="{y:.1f}" width="60" height="{hgt:.1f}" fill="{rnd.choice((deep, light, base))}" opacity="{rnd.uniform(0.25, 0.55):.2f}" transform="rotate({tilt * 0.4:.1f} 40 40)"/>')
            y += hgt + rnd.uniform(1, 5)
        if rnd.random() < 0.6:
            g.append(f'<ellipse cx="{rnd.uniform(32, 50):.1f}" cy="{rnd.uniform(42, 52):.1f}" rx="5" ry="2.6" fill="{deep}" opacity="0.7"/>')
    elif kind == "rocky":
        for _ in range(rnd.randint(5, 9)):
            x, y, r = rnd.uniform(24, 56), rnd.uniform(24, 56), rnd.uniform(1.5, 4.5)
            g.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{deep}" opacity="0.55"/><circle cx="{x - r * 0.25:.1f}" cy="{y - r * 0.25:.1f}" r="{r * 0.7:.1f}" fill="{light}" opacity="0.18"/>')
    else:      # ice: pale caps and cracks
        g.append(f'<ellipse cx="40" cy="20" rx="16" ry="6" fill="#ffffff" opacity="0.7"/><ellipse cx="40" cy="60" rx="14" ry="5" fill="#ffffff" opacity="0.6"/>')
        for _ in range(4):
            x = rnd.uniform(24, 56)
            g.append(f'<path d="M{x:.1f},30 q{rnd.uniform(-6, 6):.1f},8 {rnd.uniform(-4, 4):.1f},18" stroke="{deep}" stroke-width="0.8" fill="none" opacity="0.6"/>')
    g.append('<circle cx="40" cy="40" r="22" fill="url(#shade)"/></g>')
    b += g
    if ring:   # the front half of the ring
        b.append(f'<path d="M5,40 A35,9 0 0 0 75,40" fill="none" stroke="{light}" stroke-width="3" opacity="0.9" transform="rotate({tilt:.1f} 40 40)"/>')
    if rnd.random() < 0.5:   # a moon
        a = rnd.uniform(0, 2 * math.pi)
        b.append(f'<circle cx="{40 + 31 * math.cos(a):.1f}" cy="{40 + 31 * math.sin(a):.1f}" r="3" fill="#d8dbf5"/>')
    return wrap("".join(b), d, vb="0 0 80 80", w=80, h=80)


# ── the live header ───────────────────────────────────────────────────────────
def header_files(d):
    W, H = 300, 130
    par = "xMidYMid slice"
    sky = (rad("neb1", [(0, "#6b3fc4", 0.55), (1, "#6b3fc4", 0)], 0.25, 0.4, 0.5)
           + rad("neb2", [(0, "#ff5d9a", 0.35), (1, "#ff5d9a", 0)], 0.7, 0.7, 0.45)
           + rad("neb3", [(0, "#2f8fd8", 0.4), (1, "#2f8fd8", 0)], 0.55, 0.2, 0.4)
           + lin("bg", [(0, "#0a0b1f", 1), (1, "#05060f", 1)]))
    open(f"{d}/sky.svg", "w").write(wrap(f'<rect width="{W}" height="{H}" fill="url(#bg)"/><rect width="{W}" height="{H}" fill="url(#neb1)"/>'
                                         f'<rect width="{W}" height="{H}" fill="url(#neb3)"/><rect width="{W}" height="{H}" fill="url(#neb2)"/>'
                                         + stars_svg(5, 70, W, H, 0.7), sky, f"0 0 {W} {H}", W, H, par))
    open(f"{d}/twinkle-a.svg", "w").write(wrap(stars_svg(11, 26, W, H, 1.3), "", f"0 0 {W} {H}", W, H, par))
    sparkle = "".join(f'<g transform="translate({x},{y})"><path d="M0,-4 L0.9,-0.9 L4,0 L0.9,0.9 L0,4 L-0.9,0.9 L-4,0 L-0.9,-0.9 Z" fill="#ffffff"/></g>'
                      for x, y in ((40, 24), (122, 16), (188, 44), (262, 22), (90, 62)))
    open(f"{d}/twinkle-b.svg", "w").write(wrap(stars_svg(23, 18, W, H, 1.0, ("#ffe9c4", "#cfe8ff")) + sparkle, "", f"0 0 {W} {H}", W, H, par))
    gd = (rad("gball", [(0, "#ffe1b0", 1), (0.5, "#f2a35a", 1), (1, "#7a3c1c", 1)], 0.35, 0.32, 0.72)
          + rad("gshade", [(0.5, "#000", 0), (1, "#000", 0.6)], 0.3, 0.3, 0.75) + '<clipPath id="g"><circle cx="50" cy="50" r="26"/></clipPath>')
    bands = "".join(f'<rect x="20" y="{y}" width="60" height="{h}" fill="{c}" opacity="0.4"/>' for y, h, c in
                    ((30, 4, "#7a3c1c"), (38, 3, "#ffe1b0"), (46, 6, "#b8642c"), (56, 3, "#ffe1b0"), (62, 5, "#7a3c1c"), (70, 3, "#b8642c")))
    open(f"{d}/giant.svg", "w").write(wrap(
        '<ellipse cx="50" cy="50" rx="44" ry="11" fill="none" stroke="#ffe1b0" stroke-width="3.2" opacity="0.5" transform="rotate(-18 50 50)"/>'
        '<circle cx="50" cy="50" r="26" fill="url(#gball)"/>'
        f'<g clip-path="url(#g)" transform="rotate(-18 50 50)">{bands}</g><circle cx="50" cy="50" r="26" fill="url(#gshade)"/>'
        '<path d="M6,50 A44,11 0 0 0 94,50" fill="none" stroke="#ffe1b0" stroke-width="3.2" opacity="0.95" transform="rotate(-18 50 50)"/>'
        '<circle cx="88" cy="22" r="4.2" fill="#d8dbf5"/><circle cx="87" cy="21" r="1.4" fill="#ffffff" opacity="0.7"/>',
        gd, "0 0 100 100", 100, 100))
    cd = lin("tail", [(0, "#ffffff", 0), (1, "#cfe8ff", 0.95)], 0, 0, 1, 0)
    open(f"{d}/comet.svg", "w").write(wrap(
        f'<g transform="rotate(18 150 40)"><path d="M60,40 L190,37 L190,43 Z" fill="url(#tail)"/><circle cx="191" cy="40" r="3.2" fill="#ffffff"/>'
        '<circle cx="191" cy="40" r="7" fill="#cfe8ff" opacity="0.35"/></g>', cd, f"0 0 {W} {H}", W, H, par))


# ── nebula backdrops (Pillow) ─────────────────────────────────────────────────
def nebula(w, h, seed, strength, star_n):
    """Soft nebula wisps over mostly dark space, then a scatter of stars."""
    from PIL import Image, ImageChops, ImageFilter
    rnd = random.Random(seed)

    def noise(scale, blur):
        sw, sh = max(2, w // scale), max(2, h // scale)
        small = Image.new("L", (sw, sh))
        small.putdata([rnd.randint(0, 255) for _ in range(sw * sh)])
        return small.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(blur))

    def wisp(scale, blur, cut, gain):
        # keep only the brightest swells of two noise octaves: sparse, soft clouds
        m = ImageChops.multiply(noise(scale, blur), noise(scale // 2, blur // 2))
        return m.point(lambda v: max(0, min(255, int((v - cut) * gain))))

    base = Image.new("RGB", (w, h), (5, 6, 16))
    for (scale, blur, cut, gain), col in (((260, 40, 40, 2.6), (120, 70, 220)),
                                          ((200, 30, 50, 2.4), (40, 130, 220)),
                                          ((300, 50, 55, 2.8), (230, 80, 160))):
        mask = wisp(scale, blur, cut, gain)
        layer = Image.new("RGB", (w, h), tuple(int(c * strength) for c in col))
        base = ImageChops.add(base, ImageChops.multiply(layer, Image.merge("RGB", (mask, mask, mask))))
    px = base.load()
    for _ in range(star_n):
        x, y = rnd.randrange(w), rnd.randrange(h)
        v = rnd.choice((rnd.randint(90, 170), rnd.randint(90, 170), rnd.randint(180, 255)))
        c = rnd.choice(((v, v, v), (v, int(v * 0.92), int(v * 0.8)), (int(v * 0.85), int(v * 0.92), v)))
        px[x, y] = c
        if v > 235 and 0 < x < w - 1 and 0 < y < h - 1:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                px[x + dx, y + dy] = tuple(int(k * 0.45) for k in c)
    return base


def main():
    fleet = os.path.join(OUT, "mods/cosmos-agents/fleet")
    planets = os.path.join(OUT, "mods/cosmos-spaces/planets")
    chrome = os.path.join(OUT, "mods/cosmos-chrome")
    for p in (fleet, planets, chrome):
        os.makedirs(p, exist_ok=True)
    for name, fn in FLEET.items():
        body, fx, accent = fn()
        glow = rad("glow", [(0, accent, 0.22), (1, accent, 0)], 0.5, 0.45, 0.55)
        open(f"{fleet}/{name}.svg", "w").write(wrap(f'<ellipse cx="60" cy="66" rx="58" ry="62" fill="url(#glow)"/>{body}', DEFS + glow))
        open(f"{fleet}/{name}-fx.svg", "w").write(wrap(fx, FLAME + BLUEFLAME))
    open(f"{fleet}/beacon.svg", "w").write(wrap(
        '<circle cx="60" cy="66" r="50" fill="none" stroke="#ff5d7a" stroke-width="3"/><circle cx="60" cy="66" r="36" fill="none" stroke="#ff5d7a" stroke-width="2" opacity="0.6"/>'
        '<rect width="120" height="160" fill="#ff5d7a" opacity="0.1"/><circle cx="100" cy="18" r="9" fill="#ff5d7a"/><circle cx="100" cy="18" r="4" fill="#fff"/>'))
    open(f"{fleet}/stars.svg", "w").write(wrap(stars_svg(77, 60, 140, 160, 0.9), "", "0 0 140 160", 140, 160))
    for i in range(14):
        open(f"{planets}/p{i}.svg", "w").write(planet(i))
    header_files(chrome)
    try:
        nebula(560, 2000, 3, 0.28, 900).save(f"{chrome}/nebula-sidebar-dim.png", optimize=True)
        nebula(1600, 1000, 9, 0.34, 800).save(f"{chrome}/nebula-stage.png", optimize=True)
    except ImportError:
        print("Pillow missing: backdrops skipped")


main()
