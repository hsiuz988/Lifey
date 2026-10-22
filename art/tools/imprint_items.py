"""生活印記的家具：art/source/furniture/<key>.png（GPT 白底單張）→ public/room/imprints/<key>.webp

python3 art/tools/imprint_items.py
  去背 → 縮到在房間裡的寬度 → 外框重畫成房間的粗細和顏色（縮小後線會變細變淡）
  印出每件的寬高，放進 public/joys-config.js 的 IMPRINTS（位置 x、y 是底部中間，房間座標）
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'art/tools'))
from joy_icons import white_cut  # noqa: E402

SRC = ROOT / 'art/source/furniture'
OUT = ROOT / 'public/room/imprints'
LINE = (62, 23, 11)  # 房間外框的顏色
# key: 在房間裡的寬度（房間座標）
WIDTH = {'cat': 130, 'coffee': 54, 'meal': 215, 'gift': 105, 'bear': 95, 'hearts': 118,
         'paw': 120, 'moon': 44, 'star': 200, 'sneaker': 62,
         'cake': 58, 'call': 84, 'camera': 52, 'home': 215, 'plant': 64, 'sparkle': 300, 'sunset': 96,
         'game': 110, 'workout': 100, 'book': 118,
         'bike': 66, 'bath': 54, 'letter': 58, 'umbrella': 62, 'shop': 88, 'clean': 100, 'sun': 70, 'movie': 72,
         'sing': 58, 'music': 44, 'icecream': 38, 'cook': 215}
# 掛在牆上的要照牆的斜度斜過去：每往右 1px 往下幾 px（GPT 畫的是正面，右牆約往下 0.49，原圖的線已經斜 0.19）
# 負的是往右上升：左牆、窗簾桿（約 -0.49）
SHEAR = {'star': 0.3, 'sparkle': -0.49, 'sunset': -0.49}
# GPT 畫的角度差一點的，順時針轉幾度跟家具平行（電話要和電視櫃平行）
ROTATE = {'call': 11}
# 小東西的外框細一點（預設 3px）
LINE_W = {'star': 2, 'sparkle': 2}


# 有被包起來的白底洞要清掉的（只列確定是背景的：碗裡的白飯、星星吊飾的白星星和背景一樣白，不能清）
HOLES = {'call', 'bike', 'coffee', 'workout', 'sun', 'music'}


def cut(path):
    """去背：邊緣連過來的白色（white_cut），再加上被包起來、顏色和背景一樣的白色洞
    （電話線圈、安全帽帶子中間）；物件本身的白（奶油、杯子、貓毛）比背景暗，留著"""
    im = white_cut(path)
    if path.stem not in HOLES:
        return im
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(int)
    white = rgb.min(-1) > 232
    lab, n = ndimage.label(white)
    edge = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
    bg = rgb[np.isin(lab, list(edge))].mean(0)
    hole = np.zeros(white.shape, bool)
    for i in range(1, n + 1):
        if i in edge:
            continue
        px = lab == i
        if px.sum() >= 150 and np.abs(rgb[px].mean(0) - bg).max() < 6:
            hole |= px
    if not hole.any():
        return im
    m = ~np.isin(lab, list(edge)) & ~hole
    m = ndimage.binary_opening(m, iterations=1)
    full = Image.fromarray(np.dstack([rgb.astype(np.uint8), (m * 255).astype(np.uint8)]), 'RGBA')
    return full.crop(full.getbbox())


def reline(im, w=3):
    """沿外輪廓重畫一圈跟房間一樣的線；細的部分（氣球線）不重畫，不然會整條變黑"""
    a = np.array(im)
    m = a[..., 3] > 128
    thick = ndimage.binary_opening(m, iterations=w)
    ring = thick & ~ndimage.binary_erosion(thick, iterations=w)
    a[ring, :3] = LINE
    a[..., 3] = np.where(m, 255, 0)
    return Image.fromarray(a)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for key, w in WIDTH.items():
        im = cut(SRC / f'{key}.png')
        if key in ROTATE:
            im = im.rotate(-ROTATE[key], expand=True, resample=Image.BICUBIC)
            im = im.crop(im.getbbox())
        if key in SHEAR:
            k = SHEAR[key]
            dy = round(im.width * abs(k))
            im = im.transform((im.width, im.height + dy), Image.AFFINE, (1, 0, 0, -k, 1, min(0, k) * im.width), Image.NEAREST)
            im = im.crop(im.getbbox())
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im = reline(im, LINE_W.get(key, 3))
        im.save(OUT / f'{key}.webp', lossless=True)
        print(f'{key}: w {im.width}, h {im.height}')


if __name__ == '__main__':
    main()
