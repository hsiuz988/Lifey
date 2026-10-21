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
WIDTH = {'cat': 130, 'coffee': 70, 'meal': 170, 'gift': 105, 'bear': 95, 'hearts': 85}


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
        im = white_cut(SRC / f'{key}.png')
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im = reline(im)
        im.save(OUT / f'{key}.webp', lossless=True)
        print(f'{key}: w {im.width}, h {im.height}')


if __name__ == '__main__':
    main()
