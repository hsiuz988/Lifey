"""累積幸福的像素圖示：從一整張 6×4 的圖示表切成一個一個去背的 webp

python3 art/tools/joy_icons.py
  讀 art/source/joys/sheet.png（GPT 生的，暗色背景加光暈）
  寫 public/joys/<key>.webp（96×96 透明背景）＋ art/source/joys/preview.png（白底預覽）

去背：背景是糊糊的漸層，圖示有深色外框。比「模糊後的自己」暗很多的像素就是外框，
外框圍起來的地方填滿就是圖示；被圖示圍住的背景（腳踏車三角形）用「顏色接近附近背景、又很平滑」挖掉。
雨滴、愛心這種分開的小東西用重心決定屬於哪一格。
SKIP 是光暈太重、等重畫的（app 裡先用 emoji）；單張重畫的放 art/source/joys/<key>.png（白底），會蓋過表裡的。
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import ConvexHull

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art/source/joys/sheet.png'
OUT = ROOT / 'public/joys'
KEYS = [
    'cat', 'coffee', 'meal', 'camera', 'gift', 'sunset',
    'bear', 'letter', 'book', 'sneaker', 'plant', 'music',
    'cake', 'star', 'umbrella', 'moon', 'bike', 'icecream',
    'hearts', 'home', 'paw', 'bath', 'sparkle', 'sun',
]
SKIP = {'music', 'sparkle', 'sun'}  # 表裡光暈太重的，都已經用單張重畫取代
DARK = 25      # 比附近（模糊後）暗多少算外框
HOLE_TOL = 30  # 被圍住的區塊跟附近背景差多少以內算背景
HOLES = {'bike'}  # 只有這些會挖洞（夕陽、月亮的顏色跟光暈太像，挖了會整個空掉）
GAPS = {'sunset': 'hull', 'moon': 4}  # 外框有缺口、要先補起來才填得滿的
POP = 70       # 跟背景差這麼多的顏色一定是圖示
SIZE = 96
# 格子的分界（圖示沒有排在整齊的 256 格上，筷子會掉到下一列）
COLS = [270, 520, 775, 1030, 1280]
ROWS = [315, 545, 770]


def masks(px):
    """整張一起算：外框 → 填滿 → 挖掉被圍住的背景"""
    lum = px @ [0.299, 0.587, 0.114]
    line = lum < ndimage.gaussian_filter(lum, 8) - DARK
    line = ndimage.binary_closing(line, iterations=1)
    filled = ndimage.binary_fill_holes(line)
    for r in range(4):  # 外框有缺口的，在那一格裡多補幾次再填
        for c in range(6):
            gap = GAPS.get(KEYS[r * 6 + c])
            if gap:
                ys = slice(([0] + ROWS)[r], (ROWS + [px.shape[0]])[r])
                xs = slice(([0] + COLS)[c], (COLS + [px.shape[1]])[c])
                if gap == 'hull':  # 底下整個開口的（夕陽）：用外框的凸包填
                    lab, n = ndimage.label(line[ys, xs])
                    sizes = np.bincount(lab.ravel())
                    big = np.isin(lab, [i for i in range(1, n + 1) if sizes[i] >= 80])
                    pts = np.argwhere(big)[:, ::-1]
                    poly = Image.new('1', big.shape[::-1])
                    ImageDraw.Draw(poly).polygon([tuple(p) for p in pts[ConvexHull(pts).vertices]], fill=1)
                    filled[ys, xs] |= np.asarray(poly)
                else:
                    filled[ys, xs] |= ndimage.binary_fill_holes(ndimage.binary_closing(line[ys, xs], iterations=gap))
    outside = ~filled
    wgt = ndimage.gaussian_filter(outside.astype(float), 20)
    est = np.stack([ndimage.gaussian_filter(px[..., i] * outside, 20) for i in range(3)], -1) / np.maximum(wgt, 1e-3)[..., None]
    # 雨滴這種外框不完整的小東西：顏色跟背景差很多的也算
    far = np.abs(px - est).max(-1) > POP
    far = ndimage.binary_opening(far, iterations=2)
    filled |= far & ndimage.binary_fill_holes(far)
    inner = filled & ~ndimage.binary_dilation(line, iterations=2)
    lab, n = ndimage.label(inner)
    for i in range(1, n + 1):
        comp = lab == i
        if comp.sum() < 20:
            continue
        cy, cx = ndimage.center_of_mass(comp)
        if KEYS[cell_of(cy, cx)] not in HOLES:
            continue
        c = px[comp]
        if np.abs(c.mean(0) - est[comp].mean(0)).max() <= HOLE_TOL and c.std(0).max() < 14:
            # 連同外框內側那一圈一起挖掉
            filled &= ~(ndimage.binary_dilation(comp, iterations=2) & ~line)
    return ndimage.binary_opening(filled, iterations=1)


def cell_of(cy, cx):
    return int(np.searchsorted(ROWS, cy)) * 6 + int(np.searchsorted(COLS, cx))


def square(img, size=SIZE, pad=4):
    side = max(img.size)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    inner = size - pad * 2
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(canvas.resize((inner, inner), Image.LANCZOS), (pad, pad))
    return out


def white_cut(path):
    """單張白底的圖：從邊緣連過來的白色都是背景（光芒之間的縫也會連到）"""
    rgb = np.asarray(Image.open(path).convert('RGB'))
    lab, _ = ndimage.label(rgb.min(-1) > 232)
    edge = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
    m = ndimage.binary_opening(~np.isin(lab, list(edge)), iterations=1)
    img = Image.fromarray(np.dstack([rgb, (m * 255).astype(np.uint8)]), 'RGBA')
    return img.crop(img.getbbox())


def main():
    sheet = Image.open(SRC).convert('RGB')
    px = np.asarray(sheet, dtype=float)
    mask = masks(px)
    lab, n = ndimage.label(mask)
    groups = {}
    for i, (sy, sx) in enumerate(ndimage.find_objects(lab), 1):
        if (lab[sy, sx] == i).sum() < 40:
            continue
        cy, cx = ndimage.center_of_mass(lab == i)
        groups.setdefault(cell_of(cy, cx), []).append(i)
    OUT.mkdir(parents=True, exist_ok=True)
    preview = Image.new('RGBA', (6 * (SIZE + 16), 4 * (SIZE + 16)), (255, 255, 255, 255))
    rgb = np.asarray(sheet)
    for idx, key in enumerate(KEYS):
        single = SRC.parent / f'{key}.png'
        if single.exists():
            icon = square(white_cut(single))
        elif key in SKIP:
            continue
        else:
            m = np.isin(lab, groups.get(idx, []))
            img = Image.fromarray(np.dstack([rgb, (m * 255).astype(np.uint8)]), 'RGBA')
            icon = square(img.crop(img.getbbox()))
        icon.save(OUT / f'{key}.webp', lossless=True)
        r, c = divmod(idx, 6)
        preview.alpha_composite(icon, (c * (SIZE + 16) + 8, r * (SIZE + 16) + 8))
        print(key, end=' ')
    preview.convert('RGB').save(SRC.parent / 'preview.png')


if __name__ == '__main__':
    main()
