"""把現在的房間用 SVG 重畫（等角幾何，每件家具一個 <g>，方便在設計稿裡改顏色、位置）

python3 art/tools/room_svg.py → art/source/room_svg/room.svg
座標和 app 的房間一樣（1536×1064 畫布、地板 O/EU/EV 同 room.js），u 沿右牆、v 沿左牆、z 是高度（px）
"""
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'art/source/room_svg'
O, EU, EV = (763, 348), (674, 352), (-658, 320)
WALL = 345
LINE = '#5b3a2e'


def P(u, v, z=0):
    return (O[0] + u * EU[0] + v * EV[0], O[1] + u * EU[1] + v * EV[1] - z)


def pts(ps):
    return ' '.join(f'{x:.1f},{y:.1f}' for x, y in ps)


def poly(ps, fill, sw=3, extra=''):
    return f'<polygon points="{pts(ps)}" style="fill:{fill};stroke:{LINE};stroke-width:{sw};stroke-linejoin:round" {extra}/>'


def line(a, b, color=LINE, sw=2):
    return f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" style="stroke:{color};stroke-width:{sw};stroke-linecap:round"/>'


def box(u0, u1, v0, v1, z0, z1, top, su, sv, sw=3):
    """長方體：看得到上面、u1 那面（朝右下）、v1 那面（朝左下）"""
    return ''.join([
        poly([P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1)], su, sw),
        poly([P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1)], sv, sw),
        poly([P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], top, sw),
    ])


def rwall(u0, u1, z0, z1, fill, sw=3, v=-0.002):  # 右牆上的長方形（v=0 平面）
    return poly([P(u0, v, z0), P(u1, v, z0), P(u1, v, z1), P(u0, v, z1)], fill, sw)


def lwall(v0, v1, z0, z1, fill, sw=3, u=-0.002):  # 左牆上的長方形（u=0 平面）
    return poly([P(u, v0, z0), P(u, v1, z0), P(u, v1, z1), P(u, v0, z1)], fill, sw)


def floor_ellipse(cu, cv, ru, rv, z, fill, sw=3, n=56):
    return poly([P(cu + ru * math.cos(t), cv + rv * math.sin(t), z) for t in [i / n * 2 * math.pi for i in range(n)]], fill, sw)


def wall_ellipse(cu, cz, ru, rz, fill, sw=3, n=40):
    return poly([P(cu + ru * math.cos(t), -0.003, cz + rz * math.sin(t)) for t in [i / n * 2 * math.pi for i in range(n)]], fill, sw)


def flower(cx, cy, r, color):
    s = ''.join(f'<circle cx="{cx + r * math.cos(a):.1f}" cy="{cy + r * .55 * math.sin(a):.1f}" r="{r * .55:.1f}" style="fill:{color}"/>' for a in [i * 2 * math.pi / 5 for i in range(5)])
    return s + f'<circle cx="{cx}" cy="{cy}" r="{r * .4:.1f}" style="fill:#fff6c8"/>'


def leaves(cx, cy, n, r, spread, color='#6fae5c', dark='#4c8a43'):
    out = []
    for i in range(n):
        a = -math.pi / 2 + (i - (n - 1) / 2) * spread
        x, y = cx + math.cos(a) * r * 1.2, cy + math.sin(a) * r * 1.0
        out.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{r * .62:.1f}" ry="{r * .5:.1f}" transform="rotate({math.degrees(a) + 90:.0f} {x:.1f} {y:.1f})" style="fill:{color};stroke:{LINE};stroke-width:2.5"/>')
        out.append(line((cx, cy), (x, y), dark, 2))
    return ''.join(out)


def heart(cx, cy, s, fill):
    return (f'<path d="M{cx},{cy + s * .9} C{cx - s * 1.4},{cy} {cx - s * .9},{cy - s * 1.1} {cx},{cy - s * .35} '
            f'C{cx + s * .9},{cy - s * 1.1} {cx + s * 1.4},{cy} {cx},{cy + s * .9} Z" style="fill:{fill};stroke:{LINE};stroke-width:2.5;stroke-linejoin:round"/>')


def curtain(v0, v1, t0, t1):
    """窗簾：上面寬、綁帶處收窄、下面再散開；加三條摺痕"""
    shape = [P(0, v0, 284), P(0, v1, 284), P(0, t1, 175), P(0, v1 - .01, 95), P(0, v0 + .01, 95), P(0, t0, 175)]
    folds = ''.join(line(P(0, v0 + (v1 - v0) * k / 4, 280), P(0, t0 + (t1 - t0) * k / 4, 178), '#eadfd6', 2) for k in (1, 2, 3))
    return poly(shape, '#fffaf3', 2.5) + folds + lwall(t0 - .005, t1 + .005, 168, 182, '#9cc4ea', 2)


def g(name, title, body):
    return f'<g id="{name}"><title>{title}</title>{body}</g>\n'


def build():
    parts = []
    # ---- 牆和地板 ----
    parts.append(g('walls', '牆', ''.join([
        poly([P(0, 0, 0), P(0, 1, 0), P(0, 1, WALL), P(0, 0, WALL)], '#fbeee4'),
        poly([P(0, 0, 0), P(1, 0, 0), P(1, 0, WALL), P(0, 0, WALL)], '#fdf4ea'),
        poly([P(0, 1, 0), P(0, 1.035, 0), P(0, 1.035, WALL), P(0, 1, WALL)], '#e9b98e'),  # 左牆厚度
        poly([P(1, 0, 0), P(1.03, 0, 0), P(1.03, 0, WALL), P(1, 0, WALL)], '#e9b98e'),
        poly([P(0, 0, WALL), P(0, 1.035, WALL), P(0, 1, WALL)], '#e9b98e', 2),
        rwall(0, 1, 0, 22, '#d99a63', 2.5), lwall(0, 1, 0, 22, '#cf8e58', 2.5),  # 踢腳板
    ])))
    planks = ''.join(line(P(i / 14, 0), P(i / 14, 1), '#e8b583', 2) for i in range(1, 14))
    seams = ''.join(line(P(i / 14, (k * 7 + i * 3) % 10 / 10), P((i + 1) / 14, (k * 7 + i * 3) % 10 / 10), '#e8b583', 2) for i in range(14) for k in range(2))
    parts.append(g('floor', '地板', ''.join([
        poly([P(1, 1, 0), P(1, 1, -26), P(0, 1, -26), P(0, 1, 0)], '#f5a3ad'),  # 粉紅邊（左前）
        poly([P(1, 0, 0), P(1, 0, -26), P(1, 1, -26), P(1, 1, 0)], '#f7b6bd'),  # 粉紅邊（右前）
        poly([P(0, 0, 0), P(1, 0, 0), P(1, 1, 0), P(0, 1, 0)], '#f7c79a'),
        planks, seams,
    ])))
    # ---- 牆上的東西 ----
    win = ''.join([
        lwall(.17, .6, 108, 270, '#e2a066'),
        lwall(.2, .57, 120, 258, '#9fd3f2', 2),
        lwall(.2, .57, 120, 160, '#7cc57a', 0),  # 窗外的樹
        lwall(.375, .395, 120, 258, '#e2a066', 2), lwall(.2, .57, 185, 195, '#e2a066', 2),
        lwall(.12, .66, 276, 286, '#d98c4f', 2.5),  # 窗簾桿
        curtain(.58, .7, .63, .66),  # 左邊窗簾（綁在中間）
        curtain(.1, .22, .14, .17),  # 右邊窗簾
    ])
    parts.append(g('window', '窗戶和窗簾', win))
    hp = P(0, .73, 255)
    parts.append(g('hanging-plant', '牆上的吊盆', line(P(0, .73, 300), hp, '#c58a5a', 2)
                   + f'<ellipse cx="{hp[0]}" cy="{hp[1] + 14}" rx="18" ry="14" style="fill:#f6a6b8;stroke:{LINE};stroke-width:2.5"/>' + leaves(hp[0], hp[1], 3, 14, .7)))
    shelf = ''.join([
        box(0, .2, 0, .035, 168, 180, '#f2b071', '#d98c4f', '#e09a5c'),
        box(0, .035, 0, .12, 168, 180, '#f2b071', '#d98c4f', '#e09a5c'),
    ])
    sb = P(.11, .02, 180)
    shelf_items = (rwall(.07, .14, 182, 240, '#e9a76a', 2.5, v=.01) + rwall(.085, .125, 192, 230, '#fff4f2', 2, v=.008) + heart(sb[0] + 1, sb[1] - 30, 9, '#f28aa0')
                   + f'<circle cx="{P(.17, .02, 195)[0]:.0f}" cy="{P(.17, .02, 195)[1]:.0f}" r="16" style="fill:#f5a35e;stroke:{LINE};stroke-width:2.5"/>'
                   + box(.0, .05, .03, .09, 182, 200, '#a9c8ee', '#f2a6c0', '#8fb3e0', 2.5) + leaves(*P(0, .1, 190), 4, 16, .6))
    parts.append(g('wall-shelf', 'L 形層架', shelf + shelf_items))
    frames = ''.join([
        rwall(.245, .33, 140, 232, '#d98c4f'), rwall(.26, .315, 152, 220, '#a8d6f0', 2), rwall(.26, .315, 152, 175, '#7cc57a', 0),
        rwall(.35, .43, 170, 262, '#d98c4f'), rwall(.365, .415, 182, 250, '#fff6f0', 2),
        rwall(.4, .48, 95, 182, '#d98c4f'), rwall(.415, .465, 107, 170, '#ffe4c8', 2),
    ])
    tulip = P(.39, -.003, 220)
    parts.append(g('frames', '牆上的三張照片', frames + heart(tulip[0], tulip[1], 9, '#f28aa0') + line((tulip[0], tulip[1] + 8), (tulip[0], tulip[1] + 28), '#6fae5c', 3)))
    parts.append(g('calendar', '愛心月曆', rwall(.52, .64, 97, 250, '#fff4f2') + rwall(.51, .65, 250, 262, '#d98c4f', 2.5)
                   + ''.join(rwall(.535 + i * .025, .555 + i * .025, 110 + j * 22, 126 + j * 22, '#f6a6b8', 0) for i in range(4) for j in range(3))
                   + heart(*P(.58, -.003, 205), 16, '#f28aa0')))
    c = P(.735, -.003, 240)
    parts.append(g('clock', '時鐘', wall_ellipse(.735, 240, .062, 44, '#7fa7e0') + wall_ellipse(.735, 240, .048, 34, '#ffffff', 2)
                   + line(c, (c[0], c[1] - 22), LINE, 3) + line(c, (c[0] + 14, c[1] + 8), LINE, 3)))
    parts.append(g('door', '門', rwall(.805, .955, 0, 248, '#e6a46a') + rwall(.82, .94, 0, 236, '#efb27a', 2.5)
                   + rwall(.835, .925, 130, 220, '#efb27a', 2) + rwall(.835, .925, 20, 115, '#efb27a', 2)
                   + f'<circle cx="{P(.83, -.004, 110)[0]:.0f}" cy="{P(.83, -.004, 110)[1]:.0f}" r="7" style="fill:#5b5b6a;stroke:{LINE};stroke-width:2"/>'))
    parts.append(g('switch', '電燈開關', rwall(.755, .775, 115, 140, '#fff8f2', 2)))
    deco = ''.join(heart(*P(0, v, z), 8, '#f7a3b9') for v, z in [(.15, 175)]) + ''.join(heart(*P(u, -.003, z), 8, '#f7a3b9') for u, z in [(.5, 220)])
    parts.append(g('stickers', '牆上的小貼紙', deco))
    # ---- 地上 ----
    rug = floor_ellipse(.62, .56, .2, .21, 1, '#fff7f2') + floor_ellipse(.62, .56, .175, .185, 1.5, '#fff7f2', 1)
    for (fu, fv, col) in [(.55, .45, '#f7a3b9'), (.7, .5, '#8fb3e0'), (.6, .62, '#f7a3b9'), (.72, .66, '#8fb3e0'), (.5, .58, '#8fb3e0'), (.66, .74, '#f7a3b9')]:
        x, y = P(fu, fv, 2)
        rug += flower(x, y, 13, col)
    parts.append(g('rug', '圓地毯', rug))
    desk = ''.join([
        box(0, .33, 0, .14, 0, 92, '#f0b071', '#d98c4f', '#e09a5c'),
        box(.21, .33, .135, .145, 8, 80, '#e09a5c', '#d98c4f', '#e6a46a', 2.5),  # 抽屜那一側
        line(P(.21, .145, 55), P(.33, .145, 55)), line(P(.21, .145, 30), P(.33, .145, 30)),
    ])
    top = 92
    desk_items = ''.join([
        box(.02, .06, .02, .05, top, top + 38, '#f6c4d4', '#a9c8ee', '#f2a6c0', 2.5),  # 書
        leaves(*P(.09, .03, top + 30), 4, 15, .6),
        poly([P(.11, .03, top + 1), P(.2, .03, top + 1), P(.2, .1, top + 1), P(.11, .1, top + 1)], '#fdf8f0', 2.5),  # 攤開的日記
        line(P(.155, .03, top + 1), P(.155, .1, top + 1), '#c9a98a', 2),
        poly([P(.22, .08, top + 1), P(.27, .08, top + 1), P(.27, .12, top + 1), P(.22, .12, top + 1)], '#fff0f3', 2.5),  # 信
        heart(*P(.245, .1, top + 2), 6, '#f28aa0'),
        box(.27, .3, .02, .05, top, top + 28, '#ffffff', '#f4f4f4', '#ececec', 2.5),  # 筆筒
    ])
    lb = P(.22, .03, top)
    lamp = (f'<path d="M{lb[0] - 14},{lb[1]} L{lb[0] + 14},{lb[1]} L{lb[0] + 8},{lb[1] - 8} L{lb[0] - 8},{lb[1] - 8} Z" style="fill:#5f86c9;stroke:{LINE};stroke-width:2.5"/>'
            + line((lb[0], lb[1] - 8), (lb[0] + 6, lb[1] - 60), '#5f86c9', 6)
            + f'<path d="M{lb[0] - 20},{lb[1] - 58} Q{lb[0] + 6},{lb[1] - 92} {lb[0] + 30},{lb[1] - 64} Z" style="fill:#7fa7e0;stroke:{LINE};stroke-width:2.5"/>')
    parts.append(g('desk', '書桌和桌上的東西', desk + desk_items + lamp))
    chair = ''.join([
        box(.12, .2, .17, .25, 0, 52, '#9cc4ea', '#d98c4f', '#e09a5c'),
        box(.12, .2, .17, .185, 52, 120, '#f0b071', '#d98c4f', '#e09a5c'),
        poly([P(.13, .19, 60), P(.19, .19, 60), P(.19, .19, 112), P(.13, .19, 112)], '#ffd9e2', 2),  # 椅背上的毛巾
    ])
    parts.append(g('chair', '椅子', chair))
    parts.append(g('plant', '大盆栽', box(.39, .47, .03, .11, 0, 58, '#fff6f0', '#f4ece6', '#ffffff') + heart(*P(.47, .07, 30), 7, '#f28aa0')
                   + line(P(.43, .07, 58), P(.43, .07, 120), '#4c8a43', 4) + leaves(*P(.43, .07, 120), 5, 26, .55)))
    tv = ''.join([
        box(.5, .83, 0, .17, 0, 70, '#f0b071', '#d98c4f', '#e09a5c'),
        poly([P(.52, .17, 10), P(.6, .17, 10), P(.6, .17, 60), P(.52, .17, 60)], '#b9733f', 2.5),
        poly([P(.62, .17, 10), P(.7, .17, 10), P(.7, .17, 60), P(.62, .17, 60)], '#b9733f', 2.5),
        box(.635, .69, .13, .165, 12, 34, '#bfe0f5', '#f6c4d4', '#a9c8ee', 2),
        box(.55, .7, .06, .085, 70, 160, '#4b4e60', '#3d4050', '#6b6f85'),  # 電視
        poly([P(.565, .087, 80), P(.685, .087, 80), P(.685, .087, 150), P(.565, .087, 150)], '#2f3240', 2),
        box(.6, .65, .06, .1, 70, 76, '#3d4050', '#3d4050', '#4b4e60', 2),
        box(.75, .8, .04, .09, 70, 98, '#fff6f0', '#f4ece6', '#ffffff', 2.5) + leaves(*P(.775, .065, 100), 4, 15, .6),  # 小盆栽
        f'<circle cx="{P(.72, .13, 82)[0]:.0f}" cy="{P(.72, .13, 82)[1]:.0f}" r="11" style="fill:#f6a6b8;stroke:{LINE};stroke-width:2.5"/>',  # 鬧鐘
    ])
    parts.append(g('tv', '電視櫃和電視', tv))
    bed = ''.join([
        box(0, .27, .2, .87, 0, 42, '#e6a46a', '#d98c4f', '#e09a5c'),
        box(.005, .265, .22, .85, 42, 70, '#fffaf6', '#f1e6e2', '#f6eeea', 2.5),  # 床墊
        box(.005, .27, .26, .5, 70, 76, '#a9c8ee', '#8fb3e0', '#9cc4ea', 2.5),  # 藍格子被子
        ''.join(line(P(.005, .26 + i * .04, 76), P(.27, .26 + i * .04, 76), '#ffffff', 3) for i in range(1, 6)),
        ''.join(line(P(.04 + i * .045, .26, 76), P(.04 + i * .045, .5, 76), '#ffffff', 3) for i in range(5)),
        box(.03, .2, .7, .83, 70, 92, '#ffffff', '#efe6e4', '#f5efed', 2.5),  # 枕頭
        box(0, .27, .85, .9, 0, 110, '#f0b071', '#d98c4f', '#e09a5c'),  # 床頭板
        box(0, .27, .17, .2, 0, 58, '#f0b071', '#d98c4f', '#e09a5c'),  # 床尾板
        box(.24, .28, .17, .21, 0, 70, '#f2b071', '#d98c4f', '#e09a5c', 2.5),  # 床尾柱
    ])
    hx, hy = P(.18, .73, 104)
    parts.append(g('bed', '床', bed + heart(hx, hy, 22, '#f6a6b8')))
    shelfbox = box(0, .11, .84, 1, 0, 285, '#f0b071', '#d98c4f', '#e09a5c')
    rows = ''
    for k, z in enumerate([20, 92, 164, 236]):
        rows += poly([P(.11, .86, z), P(.11, .98, z), P(.11, .98, z + 60), P(.11, .86, z + 60)], '#c98249', 2)
        cols = ['#a9c8ee', '#f6c4d4', '#c7e3b5', '#fde3a6', '#d5c6ef', '#a9c8ee', '#f6c4d4']
        for i in range(5 - (k % 2)):
            v0 = .875 + i * .02
            rows += poly([P(.112, v0, z), P(.112, v0 + .016, z), P(.112, v0 + .016, z + 48), P(.112, v0, z + 48)], cols[(i + k) % 7], 2)
    shelf_leaves = leaves(*P(.05, .9, 300), 5, 22, .6) + ''.join(
        f'<ellipse cx="{P(.11, .87, z)[0]:.0f}" cy="{P(.11, .87, z)[1]:.0f}" rx="9" ry="12" style="fill:#6fae5c;stroke:{LINE};stroke-width:2"/>' for z in range(80, 290, 30))
    parts.append(g('bookshelf', '書櫃', shelfbox + rows + shelf_leaves))
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 -10 1440 1080" width="1440" height="1080" role="img" aria-label="迷你小窩：等角房間">\n'
           + ''.join(parts) + '</svg>\n')
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'room.svg').write_text(svg)
    return svg


if __name__ == '__main__':
    build()
    print('ok')
