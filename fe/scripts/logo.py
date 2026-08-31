"""
Generates every LeadBoard logo asset from one grid definition.

The mark is pixel art, so the PNGs are written pixel-by-pixel rather than
rasterised from the SVG - there is no SVG renderer in this toolchain, and none
is needed when the source is already a grid.

    cd fe && python3 scripts/logo.py

Writes public/mark.svg, public/mark-{32,180,512}.png,
public/logo-wordmark.{svg,png}, and /tmp/mark.jsx for the React component.
"""

import zlib, struct

# ---------------------------------------------------------------- palette
# same axis as the app: orange -> rose -> indigo
STOPS = [(0.00, (0xF9,0x73,0x16)), (0.45, (0xE0,0x48,0x7E)), (1.00, (0x5B,0x2B,0x9E))]

def ramp(t):
    t = max(0.0, min(1.0, t))
    for i in range(len(STOPS)-1):
        a, b = STOPS[i], STOPS[i+1]
        if a[0] <= t <= b[0]:
            f = 0 if b[0]==a[0] else (t-a[0])/(b[0]-a[0])
            return tuple(round(a[1][j] + (b[1][j]-a[1][j])*f) for j in range(3))
    return STOPS[-1][1]

# ---------------------------------------------------------------- the mark
# a board, drawn as pixels, with a tick sitting in it. 12x12.
# a board frame, with a tick sitting cleanly inside it. 12x12, and the tick
# never touches the border - it was cutting the right edge open before.
MARK = [
    "............",
    ".##########.",
    ".#........#.",
    ".#.......##.",
    ".#......##.#",
    ".#.....##..#",
    ".#.##.##...#",
    ".#..###....#",
    ".#...#.....#",
    ".#........#.",
    ".##########.",
    "............",
]

def _mark():
    g = [["."]*12 for _ in range(12)]

    # Corner brackets rather than a closed box. A full frame boxed the tick in
    # and left no room for the long arm, so both arms came out the same length
    # and it read as a chevron. Brackets also carry the scanner/terminal feel
    # the wordmark is going for.
    for (x, y) in [
        (1,1),(2,1),(1,2),          # top-left
        (9,1),(10,1),(10,2),        # top-right
        (1,9),(1,10),(2,10),        # bottom-left
        (10,9),(9,10),(10,10),      # bottom-right
    ]:
        g[y][x] = "#"

    # short arm down, long arm up and well past it
    short = [(2, 6), (3, 7)]
    corner = [(4, 8)]
    long = [(5, 7), (6, 6), (7, 5), (8, 4), (9, 3)]
    thick = [(x, y - 1) for (x, y) in short + corner + long]
    for (x, y) in short + corner + long + thick:
        g[y][x] = "#"
    return ["".join(r) for r in g]

MARK = _mark()

# ---------------------------------------------------------------- 5x7 font
FONT = {
 "L": ["#....","#....","#....","#....","#....","#....","#####"],
 "E": ["#####","#....","#....","####.","#....","#....","#####"],
 "A": [".###.","#...#","#...#","#####","#...#","#...#","#...#"],
 "D": ["####.","#...#","#...#","#...#","#...#","#...#","####."],
 "B": ["####.","#...#","#...#","####.","#...#","#...#","####."],
 "O": [".###.","#...#","#...#","#...#","#...#","#...#",".###."],
 "R": ["####.","#...#","#...#","####.","#..#.","#...#","#...#"],
}

def word(text, gap=1):
    rows = ["" for _ in range(7)]
    for i, ch in enumerate(text):
        g = FONT[ch]
        for r in range(7):
            rows[r] += g[r] + ("." * gap if i < len(text)-1 else "")
    return rows

def pixels(grid):
    return [(x, y) for y, row in enumerate(grid) for x, c in enumerate(row) if c == "#"]

# ---------------------------------------------------------------- PNG out
def write_png(path, grid, scale, pad=0, diag=True):
    h, w = len(grid), len(grid[0])
    W, H = (w + pad*2) * scale, (h + pad*2) * scale
    buf = bytearray()
    for py in range(H):
        buf.append(0)
        for px in range(W):
            gx, gy = px // scale - pad, py // scale - pad
            on = 0 <= gy < h and 0 <= gx < w and grid[gy][gx] == "#"
            if on:
                t = ((gx / max(1, w-1)) + (gy / max(1, h-1))) / 2 if diag else gx / max(1, w-1)
                buf += bytes(ramp(t)) + b"\xff"
            else:
                buf += b"\x00\x00\x00\x00"
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(buf), 9))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)
    return W, H

# ---------------------------------------------------------------- SVG out
def svg_rects(grid, ox=0, oy=0, diag=True):
    h, w = len(grid), len(grid[0])
    out = []
    for (x, y) in pixels(grid):
        t = ((x / max(1, w-1)) + (y / max(1, h-1))) / 2 if diag else x / max(1, w-1)
        r, g, b = ramp(t)
        out.append(f'<rect x="{x+ox}" y="{y+oy}" width="1" height="1" fill="#{r:02X}{g:02X}{b:02X}"/>')
    return "\n  ".join(out)

# favicon + app icons, from the mark alone
for size, scale in [(32, 2), (180, 12), (512, 36)]:
    W, H = write_png(f"public/mark-{size}.png", MARK, scale, pad=1)
    print(f"mark-{size}.png -> {W}x{H}")

open("public/mark.svg", "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="64" height="64" '
    f'shape-rendering="crispEdges">\n  {svg_rects(MARK)}\n</svg>\n'
)

# the wordmark: mark, then LEADBOARD in pixel letters
LETTERS = word("LEADBOARD")
lw = len(LETTERS[0])
canvas = []
for y in range(12):
    row = list(MARK[y])
    row += list(".." )
    if 2 <= y <= 8:
        row += list(LETTERS[y-2])
    else:
        row += ["."] * lw
    canvas.append("".join(row))

W, H = write_png("public/logo-wordmark.png", canvas, 14, pad=1)
print(f"logo-wordmark.png -> {W}x{H}")
open("public/logo-wordmark.svg", "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {len(canvas[0])} 12" '
    f'width="{len(canvas[0])*8}" height="96" shape-rendering="crispEdges">\n  {svg_rects(canvas)}\n</svg>\n'
)
print("wordmark grid:", len(canvas[0]), "x", len(canvas))

# ---------------------------------------------------------------- React mark
# emitted from the same grid, so the component can never drift from the favicon
rects = []
h, w = len(MARK), len(MARK[0])
for (x, y) in pixels(MARK):
    t = ((x / (w-1)) + (y / (h-1))) / 2
    r, g, b = ramp(t)
    rects.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="#{r:02X}{g:02X}{b:02X}" />')

jsx = """
/** The LeadBoard mark: pixel brackets and a tick, generated from the same grid
 *  as the favicon so the two can never drift apart. */
export const Mark = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 %d %d" shapeRendering="crispEdges"
       style={{ flex: 'none' }} aria-hidden="true">
    %s
  </svg>
)
""" % (w, h, "\n    ".join(rects))
open('/tmp/mark.jsx', 'w').write(jsx)
print('emitted React mark:', len(rects), 'pixels')
