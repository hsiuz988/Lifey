"""註冊頁的 logo：一張插圖（女孩和貓趴在床上）＋一張 wowo! 字。

原圖是 AI 去背的，周圍散著很多半透明的雜點：只留下夠大的區塊（主體、旁邊的小星星和愛心），
把零散的雜點清掉，裁掉透明邊，縮到手機 2 倍大小，存成 webp。
用法：python3 art/tools/setup_logo.py
輸出：public/brand/setup_hero.webp、public/brand/logo_text.webp
"""
from PIL import Image
import numpy as np, os
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'art', 'source', 'brand')
OUT = os.path.join(ROOT, 'public', 'brand')


def clean(path, width, min_area):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)[:, :, 3].astype(np.float32)
    solid = a > 90
    labels, n = ndimage.label(solid)
    sizes = ndimage.sum(solid, labels, range(1, n + 1))
    keep = np.isin(labels, [i + 1 for i, s in enumerate(sizes) if s >= min_area])
    # 留下區塊外圍一點點柔邊（白色描邊的反鋸齒），其他全部變透明
    near = ndimage.binary_dilation(keep, iterations=3)
    a = np.where(near, a, 0)
    a = np.where(a < 24, 0, a)  # 很淡的霧也拿掉
    arr = np.array(im)
    arr[:, :, 3] = a.astype(np.uint8)
    out = Image.fromarray(arr)
    x0, y0, x1, y1 = out.getbbox()
    pad = 6
    out = out.crop((max(0, x0 - pad), max(0, y0 - pad), min(out.width, x1 + pad), min(out.height, y1 + pad)))
    h = round(out.height * width / out.width)
    return out.resize((width, h), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)
for name, width, area in [('setup_hero', 720, 400), ('logo_text', 520, 150)]:
    img = clean(os.path.join(SRC, f'{name}.png'), width, area)
    img.save(os.path.join(OUT, f'{name}.webp'), 'WEBP', quality=90, method=6)
    print(name, img.size, os.path.getsize(os.path.join(OUT, f'{name}.webp')) // 1024, 'KB')
