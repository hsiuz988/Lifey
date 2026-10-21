"""把 app 的房間圖（public/room/pixel_room/room.webp）轉成像素風 SVG：一格 CELL px 一個方塊，按家具分組

python3 art/tools/room_pixel_svg.py → art/source/room_svg/room_pixel.svg
- 先縮成像素格（每格取平均），再減到 COLORS 色，同色相鄰的格子合併成長方形（橫向，再往下疊）
- 每格照它在哪件家具的範圍裡分到那一組 <g id="...">，可以整件移動、刪除、改色
- 座標和 app 的房間一樣（1536×1064）
"""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'public/room/pixel_room/room.webp'
OUT = ROOT / 'art/source/room_svg/room_pixel.svg'
CELL, COLORS = 4, 200
O, EU, EV = (763, 348), (674, 352), (-658, 320)


def P(u, v, z=0):
    return (O[0] + u * EU[0] + v * EV[0], O[1] + u * EU[1] + v * EV[1] - z)


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def ellipse(cx, cy, rx, ry, n=48):
    return [(cx + rx * math.cos(t), cy + ry * math.sin(t)) for t in [i / n * 2 * math.pi for i in range(n)]]


# 分組：前面的先搶（家具在前、牆和地板最後）；範圍是房間圖上的座標
GROUPS = [
    ('bookshelf', '書櫃', [rect(95, 338, 264, 702)]),
    ('bed', '床', [[(254, 448), (330, 440), (556, 388), (694, 444), (704, 560), (388, 704), (356, 704), (254, 642)]]),
    ('chair', '椅子', [rect(668, 355, 812, 500)]),
    ('plant', '大盆栽', [rect(914, 388, 1026, 552)]),
    ('tv', '電視櫃和電視', [[(1000, 470), (1046, 405), (1175, 450), (1180, 480), (1250, 520), (1262, 600), (1200, 662), (1135, 650), (1000, 590)]]),
    ('desk', '書桌和桌上的東西', [[(648, 330), (690, 250), (900, 240), (972, 370), (970, 470), (850, 528), (820, 520), (660, 420)]]),
    ('wall-shelf', 'L 形層架', [rect(680, 100, 906, 248)]),
    ('frame-1', '風景照', [rect(924, 202, 992, 302)]),
    ('frame-2', '鬱金香', [rect(998, 204, 1060, 306)]),
    ('frame-3', '貓咪照片', [rect(1026, 304, 1092, 398)]),
    ('calendar', '月曆', [rect(1108, 278, 1202, 442)]),
    ('clock', '時鐘', [rect(1214, 312, 1306, 418)]),
    ('door', '門', [rect(1304, 382, 1416, 672)]),
    ('door-deco', '門邊的掛飾', [rect(1404, 452, 1442, 566)]),
    ('switch', '開關', [rect(1264, 462, 1296, 516)]),
    ('hanging-plant', '牆上的吊盆', [rect(252, 296, 308, 378)]),
    ('window', '窗戶和窗簾', [[(296, 268), (640, 108), (664, 128), (664, 400), (360, 500), (296, 500)]]),
    ('stickers', '牆上的小貼紙', [rect(652, 204, 692, 240), rect(1078, 252, 1112, 286), rect(912, 162, 950, 198), rect(982, 312, 1018, 348), rect(1222, 424, 1258, 458), rect(1086, 252, 1112, 284)]),
    ('rug', '圓地毯', [ellipse(968, 678, 178, 98)]),
    ('floor', '地板', [[P(0, 0, 0), P(1, 0, 0), P(1, 0, -32), P(1, 1, -32), P(0, 1, -32), P(0, 1, 0)], [P(0, 0), P(1, 0), P(1, 1), P(0, 1)]]),
    ('walls', '牆', [rect(0, 0, 1536, 1064)]),
]


def main():
    im = Image.open(SRC).convert('RGBA')
    w, h = im.width // CELL, im.height // CELL
    small = im.resize((w, h), Image.BOX)
    alpha = np.asarray(small)[..., 3] > 128
    q = small.convert('RGB').quantize(COLORS, method=Image.MEDIANCUT, dither=Image.Dither.NONE)
    idx = np.asarray(q)
    pal = np.array(q.getpalette()[:COLORS * 3]).reshape(-1, 3)
    hexes = ['#%02x%02x%02x' % tuple(c) for c in pal]
    # 每格屬於哪一組（照格子中心點）
    owner = np.full((h, w), -1, int)
    for gi in range(len(GROUPS) - 1, -1, -1):
        m = Image.new('L', (im.width, im.height), 0)
        d = ImageDraw.Draw(m)
        for poly in GROUPS[gi][2]:
            d.polygon([tuple(p) for p in poly], fill=1)
        mm = np.asarray(m)[CELL // 2::CELL, CELL // 2::CELL][:h, :w] > 0
        owner[mm] = gi
    # 同組、同色：先橫向合併，再把一樣寬的往下疊
    rects = {gi: [] for gi in range(len(GROUPS))}
    open_ = {}
    for y in range(h):
        runs = []
        x = 0
        while x < w:
            if not alpha[y, x] or owner[y, x] < 0:
                x += 1; continue
            k, gi, x0 = idx[y, x], owner[y, x], x
            while x < w and alpha[y, x] and idx[y, x] == k and owner[y, x] == gi:
                x += 1
            runs.append((gi, k, x0, x - x0))
        nxt = {}
        for r in runs:
            if r in open_ and open_[r][1] == y:
                rec = open_[r]; rec[2] += 1; rec[1] = y + 1; nxt[r] = rec
            else:
                rec = [y, y + 1, 1]; nxt[r] = rec; rects[r[0]].append((r, rec))
        open_ = nxt
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {im.width} {im.height}" width="{im.width}" height="{im.height}" shape-rendering="crispEdges" role="img" aria-label="迷你小窩：像素房間">']
    total = 0
    for gi, (gid, title, _) in enumerate(GROUPS):
        if not rects[gi]:
            continue
        out.append(f'<g id="{gid}"><title>{title}</title>')
        for (g_, k, x0, rw), (y0, y1, _) in rects[gi]:
            out.append(f'<rect x="{x0 * CELL}" y="{y0 * CELL}" width="{rw * CELL}" height="{(y1 - y0) * CELL}" style="fill:{hexes[k]}"/>')
            total += 1
        out.append('</g>')
    out.append('</svg>\n')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text('\n'.join(out))
    print('rects', total, 'bytes', OUT.stat().st_size)


if __name__ == '__main__':
    main()
