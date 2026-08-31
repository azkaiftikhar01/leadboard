"""
Generates every LeadBoard logo asset from one grid.

The mark is sparse pixel art - rounded blocks with a real gap between them,
rather than a solid bitmap. The PNGs are drawn cell by cell instead of being
rasterised from the SVG: there is no SVG renderer in this toolchain, and none is
needed when the source is already a grid.

    cd fe && python3 scripts/logo.py
"""
import zlib, struct, math

# ---------------------------------------------------------------- palette
STOPS = [(0.00, (0xF9, 0x73, 0x16)), (0.45, (0xE0, 0x48, 0x7E)), (1.00, (0x5B, 0x2B, 0x9E))]

def ramp(t):
    t = max(0.0, min(1.0, t))
    for i in range(len(STOPS) - 1):
        a, b = STOPS[i], STOPS[i + 1]
        if a[0] <= t <= b[0]:
            f = 0 if b[0] == a[0] else (t - a[0]) / (b[0] - a[0])
            return tuple(round(a[1][j] + (b[1][j] - a[1][j]) * f) for j in range(3))
    return STOPS[-1][1]

# ---------------------------------------------------------------- the mark
#
# A tick, and nothing else. Seven blocks on a 7x5 field with a clear gap around
# every one, so it reads as deliberate pixels rather than a low-resolution
# drawing. The short arm is two steps and the long arm four, because equal arms
# read as a chevron and stop meaning "done".
GRID_W, GRID_H = 7, 5
BLOCKS = [
    (0, 2), (1, 3),          # short arm, two steps down
    (2, 4),                  # the corner
    (3, 3), (4, 2), (5, 1), (6, 0),   # long arm, four steps up
]

def tone(i):
    """Colour by position ALONG the tick, not by grid position.

    Keyed to x/y the ramp only ever travelled a fraction of its range, so every
    block came out the same rose and the palette was invisible. Walking the path
    means the first block is orange and the last is indigo, and the gradient
    reads as the stroke being drawn."""
    return i / (len(BLOCKS) - 1)

# ---------------------------------------------------------------- PNG
def rounded(px, py, size, radius):
    """Is this pixel inside a rounded square of `size` with corner `radius`?"""
    x = min(px, size - 1 - px)
    y = min(py, size - 1 - py)
    if x >= radius or y >= radius:
        return True
    dx, dy = radius - x, radius - y
    return dx * dx + dy * dy <= radius * radius

def write_png(path, cell, gap_ratio=0.19, radius_ratio=0.28, pad_cells=0.5):
    block = round(cell * (1 - gap_ratio))
    inset = (cell - block) // 2
    radius = max(1, round(block * radius_ratio))
    pad = round(cell * pad_cells)
    # square canvas: an app icon that is not square gets letterboxed by every
    # platform that shows it
    side = max(GRID_W, GRID_H) * cell + pad * 2
    W = H = side
    ox0 = (side - GRID_W * cell) // 2
    oy0 = (side - GRID_H * cell) // 2

    rows = [bytearray(b"\x00\x00\x00\x00" * W) for _ in range(H)]
    for i, (gx, gy) in enumerate(BLOCKS):
        r, g, b = ramp(tone(i))
        ox = ox0 + gx * cell + inset
        oy = oy0 + gy * cell + inset
        for by in range(block):
            for bx in range(block):
                if not rounded(bx, by, block, radius):
                    continue
                i = (ox + bx) * 4
                rows[oy + by][i:i + 4] = bytes((r, g, b, 255))

    buf = bytearray()
    for row in rows:
        buf.append(0)
        buf += row

    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(buf), 9))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)
    return W, H

# ---------------------------------------------------------------- SVG / JSX
def rects(unit=10, gap=1.9, rx=2.4):
    out = []
    for i, (x, y) in enumerate(BLOCKS):
        r, g, b = ramp(tone(i))
        out.append(
            f'<rect x="{x * unit + gap / 2:g}" y="{y * unit + gap / 2:g}" '
            f'width="{unit - gap:g}" height="{unit - gap:g}" rx="{rx:g}" '
            f'fill="#{r:02X}{g:02X}{b:02X}"/>'
        )
    return out

if __name__ == "__main__":
    for size, cell in [(32, 4), (180, 24), (512, 68)]:
        print(f"mark-{size}.png ->", write_png(f"public/mark-{size}.png", cell))

    body = "\n  ".join(rects())
    open("public/mark.svg", "w").write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {GRID_W * 10} {GRID_H * 10}" '
        f'width="{GRID_W * 10}" height="{GRID_H * 10}">\n  {body}\n</svg>\n'
    )

    jsx_body = "\n    ".join(r.replace("/>", " />") for r in rects())
    open("/tmp/mark.jsx", "w").write(f"""
/** The LeadBoard mark: a tick in seven rounded blocks, generated from the same
 *  grid as the favicon by fe/scripts/logo.py so the two cannot drift apart. */
export const Mark = ({{ size = 32 }}) => (
  <svg
    width={{size}} height={{size * {GRID_H} / {GRID_W}}} viewBox="0 0 {GRID_W * 10} {GRID_H * 10}"
    style={{{{ flex: 'none', overflow: 'visible' }}}} aria-hidden="true"
  >
    {jsx_body}
  </svg>
)
""")
    print("mark.svg + React component written")
