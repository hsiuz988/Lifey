"""從 art/source/brand/app_icon.png（女孩和貓趴在床上的圓角方框）產生 App 圖示。

主畫面圖示：切掉白底和最外圈的深藍線，從淡藍邊框開始填滿整張正方形，手機的圓角就切在淡藍邊框上。
原圖不是正方形（寬一點），上下多出來的用淡藍邊框色補。
Android 的 maskable 縮到中間 80%，網頁小圖示保留深藍外框、背景透明。
換圖後：python3 art/tools/app_icon.py（圖示檔名不變，記得把 sw.js 的 VERSION +1）
"""
from PIL import Image, ImageDraw
import numpy as np, os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'art/source/brand/app_icon.png')
OUT = os.path.join(ROOT, 'public/icons')

src = Image.open(SRC).convert('RGBA')
a = np.asarray(src.convert('RGB')).astype(int)
H, W = a.shape[:2]
dark = (a[..., 2] > 200) & (a[..., 0] < 110)   # 最外圈的深藍線

def inside(line):
    """從外往內：跳過白底和深藍線，回傳線內側第一格的位置。"""
    i = int(np.argmax(line))
    while line[i]:
        i += 1
    return i

# 在畫面中線上，從四邊往內找深藍線，切在線的內側
mid_y, mid_x = H // 2, W // 2
left = inside(dark[mid_y])
right = W - inside(dark[mid_y][::-1])
top = inside(dark[:, mid_x])
bottom = H - inside(dark[:, mid_x][::-1])
BAND = tuple(int(v) for v in np.median(a[mid_y, left + 8:left + 24], 0)) + (255,)
# 方框是圓角：四個角落會露出白底和深藍線。從原圖四角灌水找出方框外面，
# 再往內擴一條深藍線的粗細（含反鋸齒），這一圈補成淡藍邊框色
from PIL import ImageFilter
wall = Image.fromarray(((a.min(-1) <= 235) * 255).astype(np.uint8)).copy()   # 白底以外都當牆
for c in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
    ImageDraw.floodfill(wall, c, 128)
line = (left - int(np.argmax(dark[mid_y]))) + 9
outside = Image.fromarray(((np.asarray(wall) == 128) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * line + 1))
outside = np.asarray(outside)[top:bottom, left:right] > 0
px = np.asarray(src.crop((left, top, right, bottom))).copy()
px[outside] = BAND
inner = Image.fromarray(px)

def full(size):
    side = max(inner.size)
    im = Image.new('RGBA', (side, side), BAND)
    im.alpha_composite(inner, ((side - inner.width) // 2, (side - inner.height) // 2))
    return im.convert('RGB').resize((size, size), Image.LANCZOS)

def maskable(size, scale=0.8):
    """Android 會裁成圓形等形狀：整張圖示縮到中間 80%。"""
    im = Image.new('RGB', (size, size), BAND[:3])
    s = round(size * scale)
    im.paste(full(s), ((size - s) // 2, (size - s) // 2))
    return im

def favicon(size):
    """保留深藍外框，方框外面的白底變透明（從四角灌水，碰到外框就停）。"""
    box = src.crop(src.getbbox())
    px = np.asarray(box).copy()
    m = Image.fromarray(((px[..., :3].min(-1) <= 245) * 255).astype(np.uint8)).copy()
    for c in [(0, 0), (m.width - 1, 0), (0, m.height - 1), (m.width - 1, m.height - 1)]:
        ImageDraw.floodfill(m, c, 128)
    px[..., 3] = np.where(np.asarray(m) == 128, 0, 255)
    box = Image.fromarray(px)
    side = max(box.size)
    im = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    im.alpha_composite(box, ((side - box.width) // 2, (side - box.height) // 2))
    return im.resize((size, size), Image.LANCZOS)

full(1024).save(os.path.join(ROOT, 'art/source/brand/app_icon_1024.png'))
full(512).save(os.path.join(OUT, 'icon-512.png'))
full(192).save(os.path.join(OUT, 'icon-192.png'))
full(180).save(os.path.join(OUT, 'apple-touch-icon.png'))
maskable(512).save(os.path.join(OUT, 'icon-maskable-512.png'))
favicon(32).save(os.path.join(OUT, 'favicon-32.png'))
print('ok', (left, top, right, bottom), BAND)
